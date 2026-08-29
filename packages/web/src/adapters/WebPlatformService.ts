import type {
  ImageBatch,
  PlatformService,
  ScanParams,
  Settings,
} from "@mason-gallery/core";
import type { WebFileRegistry } from "../features/gallery/types";
import { getInitialWebLanguage } from "../features/i18n/webLocaleRoutes";

const SETTINGS_KEY = "mason-gallery-settings";

interface FileEntry {
  handle: FileSystemFileHandle;
  blobUrl: string;
}

class FileHandleRegistry implements WebFileRegistry {
  private entries = new Map<string, FileEntry>();
  private pendingEntries: Map<string, FileEntry> | null = null;

  beginScan(preserveExistingUrls: boolean): void {
    this.abortScan();
    if (preserveExistingUrls) {
      this.pendingEntries = new Map();
      return;
    }
    this.clear();
  }

  register(id: string, handle: FileSystemFileHandle, blobUrl: string): string {
    const entry = { handle, blobUrl };

    if (this.pendingEntries) {
      this.pendingEntries.set(id, entry);
      return id;
    }

    const previous = this.entries.get(id);
    if (previous) URL.revokeObjectURL(previous.blobUrl);
    this.entries.set(id, entry);
    return id;
  }

  completeScan(): void {
    if (!this.pendingEntries) return;

    for (const [id, entry] of this.entries) {
      const replacement = this.pendingEntries.get(id);
      if (!replacement || replacement.blobUrl !== entry.blobUrl) {
        URL.revokeObjectURL(entry.blobUrl);
      }
    }

    this.entries = this.pendingEntries;
    this.pendingEntries = null;
  }

  abortScan(): void {
    if (!this.pendingEntries) return;
    for (const entry of this.pendingEntries.values()) {
      URL.revokeObjectURL(entry.blobUrl);
    }
    this.pendingEntries = null;
  }

  getBlobUrl(id: string): string {
    const entry = this.entries.get(id) ?? this.pendingEntries?.get(id);
    return entry?.blobUrl ?? id;
  }

  revoke(id: string): void {
    const entry = this.entries.get(id);
    if (entry) {
      URL.revokeObjectURL(entry.blobUrl);
      this.entries.delete(id);
    }

    const pendingEntry = this.pendingEntries?.get(id);
    if (pendingEntry) {
      URL.revokeObjectURL(pendingEntry.blobUrl);
      this.pendingEntries?.delete(id);
    }
  }

  clear(): void {
    this.abortScan();
    for (const entry of this.entries.values()) {
      URL.revokeObjectURL(entry.blobUrl);
    }
    this.entries.clear();
  }
}

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

export function getWebImageSource(
  rootIndex: number,
  relativePath: string,
): string {
  return `web-file://${rootIndex}/${relativePath}`;
}

async function* walkDirectory(
  dirHandle: FileSystemDirectoryHandle,
  formats: Set<string>,
  pathPrefix = "",
): AsyncGenerator<{
  name: string;
  path: string;
  handle: FileSystemFileHandle;
}> {
  for await (const entry of dirHandle.values()) {
    const entryPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
    if (entry.kind === "file") {
      const ext = getExtension(entry.name);
      if (formats.has(ext)) {
        yield { name: entry.name, path: entryPath, handle: entry };
      }
    } else if (entry.kind === "directory") {
      yield* walkDirectory(entry, formats, entryPath);
    }
  }
}

async function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  try {
    const { imageDimensionsFromStream } = await import("image-dimensions");
    const stream = file.stream() as ReadableStream<Uint8Array>;
    const result = await imageDimensionsFromStream(stream);
    if (result) {
      return { width: result.width, height: result.height };
    }
  } catch {
    // fallback to createImageBitmap
  }

  try {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    return null;
  }
}

const registry = new FileHandleRegistry();

let storedDirHandles: FileSystemDirectoryHandle[] = [];

export const webPlatformService: PlatformService = {
  capabilities: {
    canDeleteFiles: false,
    canRevealFile: false,
    canSelectFolder: true,
    hasCustomTitlebar: false,
    canAutoUpdate: false,
    canDragDropFolders: true,
    canBrowseArchives: false,
  },

  async scanImages(
    params: ScanParams,
    onBatch: (batch: ImageBatch) => void,
    onComplete: () => void,
    onCount?: (total: number) => void,
  ): Promise<void> {
    registry.beginScan(params.preserveExistingUrls === true);

    try {
      const formats = new Set(params.formats.map((f) => f.toLowerCase()));
      const batchSize = params.page_size;

      const fileHandles: {
        rootIndex: number;
        name: string;
        path: string;
        handle: FileSystemFileHandle;
      }[] = [];

      for (
        let rootIndex = 0;
        rootIndex < storedDirHandles.length;
        rootIndex++
      ) {
        const dirHandle = storedDirHandles[rootIndex];
        if (!dirHandle) continue;
        for await (const entry of walkDirectory(dirHandle, formats)) {
          fileHandles.push({ rootIndex, ...entry });
        }
      }

      onCount?.(fileHandles.length);

      let batch: ImageBatch["images"] = [];

      for (const entry of fileHandles) {
        const file = await entry.handle.getFile();
        const blobUrl = URL.createObjectURL(file);
        const source = getWebImageSource(entry.rootIndex, entry.path);
        const id = registry.register(source, entry.handle, blobUrl);
        const dims = await getImageDimensions(file);

        batch.push({
          source: id,
          relativePath: entry.path,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
        });

        if (batch.length >= batchSize) {
          onBatch({ images: batch, done: false });
          batch = [];
        }
      }

      onBatch({ images: batch, done: true });
      registry.completeScan();
      onComplete();
    } catch (e) {
      registry.abortScan();
      throw e;
    }
  },

  getImageUrl(source: string): string {
    return registry.getBlobUrl(source);
  },

  getThumbUrl(): string {
    return "";
  },

  async pickFolders(): Promise<string[] | null> {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: "read" });
      storedDirHandles = [dirHandle];
      return [dirHandle.name];
    } catch {
      return null;
    }
  },

  onDragDrop(callback: (paths: string[]) => void): () => void {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const items = e.dataTransfer?.items;
      if (!items) return;

      const handles: FileSystemDirectoryHandle[] = [];
      for (const item of items) {
        const handle = await item.getAsFileSystemHandle();
        if (handle?.kind === "directory") {
          handles.push(handle as FileSystemDirectoryHandle);
        }
      }

      if (handles.length > 0) {
        storedDirHandles = handles;
        callback(handles.map((h) => h.name));
      }
    };

    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);

    return () => {
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("drop", handleDrop);
    };
  },

  async loadSettings(): Promise<Partial<Settings>> {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const settings = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
      return {
        ...settings,
        language: getInitialWebLanguage(
          window.location.pathname,
          settings.language,
          window.location.search,
        ),
      };
    } catch {
      return {
        language: getInitialWebLanguage(
          window.location.pathname,
          undefined,
          window.location.search,
        ),
      };
    }
  },

  async saveSettings(key: string, value: unknown): Promise<void> {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const settings = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      settings[key] = value;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  },

  async listDirectoryTree(): Promise<string[]> {
    const directories: string[] = [];

    async function walkDirs(
      dirHandle: FileSystemDirectoryHandle,
      prefix: string,
    ) {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === "directory") {
          const path = prefix ? `${prefix}/${entry.name}` : entry.name;
          directories.push(path);
          await walkDirs(entry, path);
        }
      }
    }

    for (const dirHandle of storedDirHandles) {
      await walkDirs(dirHandle, "");
    }

    directories.sort();
    return directories;
  },
};
