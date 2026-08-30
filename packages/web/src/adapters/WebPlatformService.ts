import type {
  ImageBatch,
  PlatformService,
  ScanParams,
} from "@mason-gallery/core";
import type { WebFileRegistry } from "../features/gallery/types";
import { getInitialWebLanguage } from "../features/i18n/webLocaleRoutes";
import {
  loadDirectoryHandles,
  loadWebSettings,
  replaceDirectoryHandles,
  saveWebSettings,
} from "../persistence/webDatabase";

interface FileEntry {
  handle: FileSystemFileHandle;
  blobUrl: string;
}

class FileHandleRegistry implements WebFileRegistry {
  private entries = new Map<string, FileEntry>();
  private pendingEntries: Map<string, FileEntry> | null = null;

  beginScan(preserveExistingUrls: boolean): void {
    if (preserveExistingUrls) {
      this.abortScan();
    } else {
      this.clear();
    }
    this.pendingEntries = new Map();
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
const IMAGE_PROBE_CONCURRENCY = 6;

let storedDirHandles: FileSystemDirectoryHandle[] = [];
let directoryHandlesLoaded = false;
let directoryHandlesLoadPromise: Promise<void> | null = null;
const permissionRequests = new WeakMap<
  FileSystemDirectoryHandle,
  Promise<boolean>
>();

async function ensureDirectoryHandlesLoaded(): Promise<void> {
  if (directoryHandlesLoaded) return;
  if (directoryHandlesLoadPromise) return directoryHandlesLoadPromise;

  directoryHandlesLoadPromise = (async () => {
    try {
      const handles = await loadDirectoryHandles();
      if (!directoryHandlesLoaded) {
        storedDirHandles = handles;
        directoryHandlesLoaded = true;
      }
    } catch (error) {
      console.warn("Failed to restore browser directory handles:", error);
      directoryHandlesLoaded = true;
    }
  })();

  try {
    await directoryHandlesLoadPromise;
  } finally {
    directoryHandlesLoadPromise = null;
  }
}

async function replaceStoredDirectoryHandles(
  handles: FileSystemDirectoryHandle[],
): Promise<void> {
  storedDirHandles = handles;
  directoryHandlesLoaded = true;
  try {
    await replaceDirectoryHandles(handles);
  } catch (error) {
    console.warn("Failed to persist browser directory handles:", error);
  }
}

async function hasReadPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const existing = permissionRequests.get(handle);
  if (existing) return existing;

  const request = (async () => {
    try {
      const current = await handle.queryPermission({ mode: "read" });
      if (current === "granted") return true;
      if (current === "denied") return false;
      return (await handle.requestPermission({ mode: "read" })) === "granted";
    } catch {
      return false;
    }
  })();
  permissionRequests.set(handle, request);

  try {
    return await request;
  } finally {
    permissionRequests.delete(handle);
  }
}

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
    await ensureDirectoryHandlesLoaded();
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
        if (!(await hasReadPermission(dirHandle))) continue;
        for await (const entry of walkDirectory(dirHandle, formats)) {
          fileHandles.push({ rootIndex, ...entry });
        }
      }

      onCount?.(fileHandles.length);

      let batch: ImageBatch["images"] = [];

      for (
        let offset = 0;
        offset < fileHandles.length;
        offset += IMAGE_PROBE_CONCURRENCY
      ) {
        const entries = fileHandles.slice(
          offset,
          offset + IMAGE_PROBE_CONCURRENCY,
        );
        const images = await Promise.all(
          entries.map(async (entry) => {
            const file = await entry.handle.getFile();
            const blobUrl = URL.createObjectURL(file);
            const source = getWebImageSource(entry.rootIndex, entry.path);
            const id = registry.register(source, entry.handle, blobUrl);
            const dims = await getImageDimensions(file);
            return {
              source: id,
              relativePath: entry.path,
              width: dims?.width ?? null,
              height: dims?.height ?? null,
            };
          }),
        );

        batch.push(...images);
        while (batch.length >= batchSize) {
          onBatch({ images: batch.slice(0, batchSize), done: false });
          batch = batch.slice(batchSize);
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
      await replaceStoredDirectoryHandles([dirHandle]);
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
        await replaceStoredDirectoryHandles(handles);
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

  async loadSettings() {
    const settings = await loadWebSettings();
    return {
      ...settings,
      language: getInitialWebLanguage(
        window.location.pathname,
        settings.language,
        window.location.search,
      ),
    };
  },

  async saveSettings(settings): Promise<void> {
    await saveWebSettings(settings);
  },

  async listDirectoryTree(): Promise<string[]> {
    await ensureDirectoryHandlesLoaded();
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
      if (!(await hasReadPermission(dirHandle))) continue;
      await walkDirs(dirHandle, "");
    }

    directories.sort();
    return directories;
  },
};
