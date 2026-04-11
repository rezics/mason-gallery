import type {
  ImageBatch,
  PlatformService,
  ScanParams,
  Settings,
} from "@mason-gallery/core";

const SETTINGS_KEY = "mason-gallery-settings";

interface FileEntry {
  handle: FileSystemFileHandle;
  blobUrl: string;
}

class FileHandleRegistry {
  private entries = new Map<string, FileEntry>();
  private nextId = 0;

  register(handle: FileSystemFileHandle, blobUrl: string): string {
    const id = `web-file-${this.nextId++}`;
    this.entries.set(id, { handle, blobUrl });
    return id;
  }

  getBlobUrl(id: string): string {
    const entry = this.entries.get(id);
    if (!entry) return id;
    return entry.blobUrl;
  }

  revoke(id: string): void {
    const entry = this.entries.get(id);
    if (entry) {
      URL.revokeObjectURL(entry.blobUrl);
      this.entries.delete(id);
    }
  }

  clear(): void {
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

// Store directory handles for scanning
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
    registry.clear();

    const formats = new Set(params.formats.map((f) => f.toLowerCase()));
    const batchSize = params.page_size;

    // Phase 1: Collect all file handles (fast, no dimension extraction)
    const fileHandles: {
      name: string;
      path: string;
      handle: FileSystemFileHandle;
    }[] = [];
    for (const dirHandle of storedDirHandles) {
      for await (const entry of walkDirectory(dirHandle, formats)) {
        fileHandles.push(entry);
      }
    }

    // Emit total count immediately
    if (onCount) {
      onCount(fileHandles.length);
    }

    // Phase 2: Process dimensions in batches
    let batch: ImageBatch["images"] = [];

    for (const entry of fileHandles) {
      const file = await entry.handle.getFile();
      const blobUrl = URL.createObjectURL(file);
      const id = registry.register(entry.handle, blobUrl);
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

    if (batch.length > 0) {
      onBatch({ images: batch, done: true });
    } else {
      onBatch({ images: [], done: true });
    }
    onComplete();
  },

  getImageUrl(source: string): string {
    return registry.getBlobUrl(source);
  },

  async deleteFile(): Promise<void> {
    throw new Error("Delete is not supported in the web version");
  },

  async revealFile(): Promise<void> {
    throw new Error("Reveal in folder is not supported in the web version");
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
      if (raw) {
        return JSON.parse(raw) as Partial<Settings>;
      }
    } catch {
      // ignore
    }
    return {};
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
