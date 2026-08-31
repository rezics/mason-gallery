import type {
  DragDropSubscriptionOptions,
  DropListener,
  ImageBatch,
  LibraryAccessStatus,
  LibrarySource,
  LibrarySourceInput,
  LibrarySourcePatch,
  PlatformService,
  ScanParams,
} from "@mason-gallery/core";
import type { WebFileRegistry } from "../features/gallery/types";
import { getInitialWebLanguage } from "../features/i18n/webLocaleRoutes";
import {
  addStoredLibrarySources,
  type DirectoryHandleRow,
  loadDirectoryHandleRows,
  loadStoredLibrarySources,
  loadWebSettings,
  markStoredLibrarySourcesScanned,
  registerDirectoryHandles,
  removeStoredLibrarySources,
  type StoredLibrarySource,
  saveWebSettings,
  updateStoredLibrarySource,
} from "../persistence/webDatabase";
import {
  canUseFileSystemDrop,
  classifyWebDropItems,
  getSessionDirectoryHandles,
  registerSessionDirectoryHandles,
  shouldAcceptWebDrag,
} from "./webDrop";

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
  rootKey: string | number,
  relativePath: string,
): string {
  return `web-file://${encodeURIComponent(String(rootKey))}/${relativePath}`;
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

let storedDirHandles: DirectoryHandleRow[] = [];
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
      const handles = await loadDirectoryHandleRows();
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

async function registerStoredDirectoryHandles(
  handles: FileSystemDirectoryHandle[],
): Promise<DirectoryHandleRow[]> {
  const registered = await registerDirectoryHandles(handles);
  storedDirHandles = await loadDirectoryHandleRows();
  directoryHandlesLoaded = true;
  return registered;
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

async function getAccessStatus(
  source: StoredLibrarySource,
): Promise<LibraryAccessStatus> {
  if (source.kind !== "folder") return "missing";
  await ensureDirectoryHandlesLoaded();
  const row = storedDirHandles.find(
    (candidate) => candidate.sourcePath === source.path,
  );
  if (!row) return "missing";
  try {
    return (await row.handle.queryPermission({ mode: "read" })) === "granted"
      ? "ready"
      : "needs-access";
  } catch {
    return "needs-access";
  }
}

function allDirectoryHandleRows(): Array<{
  sourcePath: string;
  name: string;
  handle: FileSystemDirectoryHandle;
}> {
  return [...storedDirHandles, ...getSessionDirectoryHandles()];
}

async function listLibrarySourcesWithAccess(): Promise<LibrarySource[]> {
  const sources = await loadStoredLibrarySources();
  return Promise.all(
    sources
      .filter(
        (source): source is StoredLibrarySource & { id: number } =>
          source.id != null,
      )
      .map(async (source) => {
        const accessStatus = await getAccessStatus(source);
        const { pathKey: _pathKey, ...publicSource } = source;
        return { ...publicSource, accessStatus };
      }),
  );
}

export const webPlatformService: PlatformService = {
  get capabilities() {
    return {
      canDeleteFiles: false,
      canRevealFile: false,
      canSelectFolder: true,
      hasCustomTitlebar: false,
      canAutoUpdate: false,
      canDragDropFolders: canUseFileSystemDrop(),
      canBrowseArchives: false,
      canBatchMoveFiles: false,
    };
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
        rootKey: string;
        name: string;
        path: string;
        handle: FileSystemFileHandle;
      }[] = [];

      const requestedPaths = new Set(params.paths);
      const selectedHandles = allDirectoryHandleRows().filter(
        (row) =>
          requestedPaths.size === 0 ||
          requestedPaths.has(row.sourcePath) ||
          requestedPaths.has(row.name),
      );
      for (const row of selectedHandles) {
        if (!(await hasReadPermission(row.handle))) continue;
        for await (const entry of walkDirectory(row.handle, formats)) {
          fileHandles.push({ rootKey: row.sourcePath, ...entry });
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
            const source = getWebImageSource(entry.rootKey, entry.path);
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
      const registered = await registerStoredDirectoryHandles([dirHandle]);
      return registered.map((row) => row.sourcePath);
    } catch {
      return null;
    }
  },

  onDragDrop(
    listener: DropListener,
    options?: DragDropSubscriptionOptions,
  ): () => void {
    const target = options?.target ?? document;

    const handleDragOver = (event: Event) => {
      const dragEvent = event as DragEvent;
      if (!listener.accepts() || !shouldAcceptWebDrag(dragEvent.dataTransfer)) {
        return;
      }
      dragEvent.preventDefault();
      listener.onOver?.({ x: dragEvent.clientX, y: dragEvent.clientY });
    };

    const handleDragLeave = (event: Event) => {
      const dragEvent = event as DragEvent;
      const related = dragEvent.relatedTarget;
      if (
        target instanceof Node &&
        related instanceof Node &&
        target.contains(related)
      ) {
        return;
      }
      listener.onCancel?.();
    };

    const handleDrop = (event: Event) => {
      const dragEvent = event as DragEvent;
      if (!listener.accepts() || !shouldAcceptWebDrag(dragEvent.dataTransfer)) {
        return;
      }
      dragEvent.preventDefault();
      listener.onCancel?.();

      const items = dragEvent.dataTransfer?.items;
      if (!items) {
        listener.onDrop({ accepted: [], rejected: [] });
        return;
      }

      const persist =
        listener.persistence() === "durable"
          ? registerStoredDirectoryHandles
          : registerSessionDirectoryHandles;

      void classifyWebDropItems(items, persist).then((batch) => {
        listener.onDrop(batch);
      });
    };

    target.addEventListener("dragover", handleDragOver);
    target.addEventListener("dragleave", handleDragLeave);
    target.addEventListener("drop", handleDrop);

    return () => {
      target.removeEventListener("dragover", handleDragOver);
      target.removeEventListener("dragleave", handleDragLeave);
      target.removeEventListener("drop", handleDrop);
    };
  },

  async loadSettings() {
    const loaded = await loadWebSettings();
    const { settings } = loaded;
    return {
      ...settings,
      language: getInitialWebLanguage(
        window.location.pathname,
        loaded.source === "persisted" ? settings.language : undefined,
        window.location.search,
      ),
    };
  },

  async saveSettings(settings): Promise<void> {
    await saveWebSettings(settings);
  },

  async openExternalUrl(url: string): Promise<void> {
    window.open(url, "_blank", "noopener,noreferrer");
  },

  async listDirectoryTree(paths: string[]): Promise<string[]> {
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

    const requestedPaths = new Set(paths);
    for (const row of allDirectoryHandleRows()) {
      if (
        requestedPaths.size > 0 &&
        !requestedPaths.has(row.sourcePath) &&
        !requestedPaths.has(row.name)
      ) {
        continue;
      }
      if (!(await hasReadPermission(row.handle))) continue;
      await walkDirs(row.handle, "");
    }

    directories.sort();
    return directories;
  },

  async listLibrarySources(): Promise<LibrarySource[]> {
    return listLibrarySourcesWithAccess();
  },

  async addLibrarySources(
    sources: LibrarySourceInput[],
  ): Promise<LibrarySource[]> {
    await ensureDirectoryHandlesLoaded();
    await addStoredLibrarySources(
      sources.map((source) => {
        const directory = allDirectoryHandleRows().find(
          (row) => row.sourcePath === source.path || row.name === source.path,
        );
        return {
          ...source,
          path: directory?.sourcePath ?? source.path,
          label: directory?.name ?? source.label,
        };
      }),
    );
    return listLibrarySourcesWithAccess();
  },

  async updateLibrarySource(
    id: number,
    patch: LibrarySourcePatch,
  ): Promise<LibrarySource[]> {
    await updateStoredLibrarySource(id, patch);
    return listLibrarySourcesWithAccess();
  },

  async removeLibrarySources(ids: number[]): Promise<LibrarySource[]> {
    await removeStoredLibrarySources(ids);
    return listLibrarySourcesWithAccess();
  },

  async markLibrarySourcesScanned(
    paths: string[],
    imageCount?: number,
  ): Promise<void> {
    await markStoredLibrarySourcesScanned(paths, imageCount);
  },
};
