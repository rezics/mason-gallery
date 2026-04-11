import type {
  ArchiveInfo,
  CacheCleanupStrategy,
  CacheStats,
  ImageBatch,
  MigrationCandidate,
  PasswordStorageMode,
  PlatformService,
  ScanArchiveParams,
  ScanParams,
  Settings,
} from "@mason-gallery/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";

const STORE_FILE = "settings.json";

let cachedServerPort: number | null = null;

async function getServerPort(): Promise<number> {
  if (cachedServerPort !== null) return cachedServerPort;
  cachedServerPort = await invoke<number>("get_image_server_port");
  return cachedServerPort;
}

export const tauriPlatformService: PlatformService = {
  capabilities: {
    canDeleteFiles: true,
    canRevealFile: true,
    canSelectFolder: true,
    hasCustomTitlebar: true,
    canAutoUpdate: true,
    canDragDropFolders: true,
    canBrowseArchives: true,
  },

  async scanImages(
    params: ScanParams,
    onBatch: (batch: ImageBatch) => void,
    onComplete: () => void,
    onCount?: (total: number) => void,
  ): Promise<void> {
    // Ensure server port is cached before images start rendering
    await getServerPort();

    let unlistenCount: (() => void) | undefined;
    if (onCount) {
      unlistenCount = await listen<{ total: number }>(
        "images:count",
        (event) => {
          onCount(event.payload.total);
          unlistenCount?.();
        },
      );
    }

    const unlisten = await listen<ImageBatch>("images:batch", (event) => {
      const batch = event.payload;
      if (batch.images.length > 0) {
        onBatch(batch);
      }
      if (batch.done) {
        onComplete();
        unlisten();
      }
    });

    await invoke("scan_directory", { params });
  },

  getImageUrl(source: string): string {
    if (cachedServerPort === null) {
      throw new Error(
        "Image server port not initialized. Call scanImages first.",
      );
    }
    // Archive URIs get served via the thumb endpoint (for browsing) or extracted path (for viewer)
    // The source is already the archive URI — the frontend calls extractArchiveEntry for full images
    return `http://localhost:${cachedServerPort}/image?path=${encodeURIComponent(source)}`;
  },

  async deleteFile(path: string): Promise<void> {
    await invoke("delete_to_trash", { path });
  },

  async revealFile(path: string): Promise<void> {
    const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
    await revealItemInDir(path);
  },

  async pickFolders(): Promise<string[] | null> {
    const selected = await open({ directory: true, multiple: true });
    if (!selected) return null;
    return Array.isArray(selected) ? selected : [selected];
  },

  onDragDrop(callback: (paths: string[]) => void): () => void {
    let unlistenFn: (() => void) | null = null;

    getCurrentWebviewWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type === "drop") {
          const paths = event.payload.paths;
          if (paths.length > 0) {
            callback(paths);
          }
        }
      })
      .then((fn) => {
        unlistenFn = fn;
      });

    return () => {
      unlistenFn?.();
    };
  },

  async loadSettings(): Promise<Partial<Settings>> {
    const store = await load(STORE_FILE, { defaults: {}, autoSave: true });
    const formats = await store.get<string[]>("formats");
    const sortMethod = await store.get<Settings["sortMethod"]>("sortMethod");
    const pageSize = await store.get<number>("pageSize");
    const language = await store.get<Settings["language"]>("language");
    const breakpoints = await store.get<Settings["breakpoints"]>("breakpoints");
    const showGridPosition = await store.get<boolean>("showGridPosition");
    const confirmDelete = await store.get<boolean>("confirmDelete");
    const showDeleteToast = await store.get<boolean>("showDeleteToast");

    return {
      ...(formats != null && { formats }),
      ...(sortMethod != null && { sortMethod }),
      ...(pageSize != null && { pageSize }),
      ...(language != null && { language }),
      ...(breakpoints != null && { breakpoints }),
      ...(showGridPosition != null && { showGridPosition }),
      ...(confirmDelete != null && { confirmDelete }),
      ...(showDeleteToast != null && { showDeleteToast }),
    };
  },

  async saveSettings(key: string, value: unknown): Promise<void> {
    const store = await load(STORE_FILE, { defaults: {}, autoSave: true });
    await store.set(key, value);
  },

  async listDirectoryTree(paths: string[]): Promise<string[]> {
    const result = await invoke<{ directories: string[] }>(
      "list_directory_tree",
      { paths },
    );
    return result.directories;
  },

  async pickArchive(): Promise<string | null> {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Archives",
          extensions: ["zip", "rar", "7z", "cbz", "cbr"],
        },
      ],
    });
    if (!selected) return null;
    return Array.isArray(selected) ? selected[0] ?? null : selected;
  },

  async scanArchive(
    params: ScanArchiveParams,
    onBatch: (batch: ImageBatch) => void,
    onComplete: () => void,
    onCount?: (total: number) => void,
  ): Promise<void> {
    await getServerPort();

    let unlistenCount: (() => void) | undefined;
    if (onCount) {
      unlistenCount = await listen<{ total: number }>(
        "images:count",
        (event) => {
          onCount(event.payload.total);
          unlistenCount?.();
        },
      );
    }

    const unlisten = await listen<ImageBatch>("images:batch", (event) => {
      const batch = event.payload;
      if (batch.images.length > 0) {
        onBatch(batch);
      }
      if (batch.done) {
        onComplete();
        unlisten();
      }
    });

    await invoke("scan_archive", { params });
  },

  async extractArchiveEntry(uri: string): Promise<string> {
    return invoke<string>("extract_archive_entry", { uri });
  },

  async getArchiveInfo(path: string): Promise<ArchiveInfo> {
    return invoke<ArchiveInfo>("get_archive_info", { path });
  },

  async getCacheStats(): Promise<CacheStats[]> {
    return invoke<CacheStats[]>("get_cache_stats");
  },

  async clearCache(archiveId?: number): Promise<void> {
    await invoke("clear_cache", { archiveId: archiveId ?? null });
  },

  async pinCache(archiveId: number, pinned: boolean): Promise<void> {
    await invoke("pin_cache", { archiveId, pinned });
  },

  async unlockArchive(
    path: string,
    password: string,
    remember: boolean,
    storageMode?: PasswordStorageMode,
    masterPassword?: string,
  ): Promise<void> {
    await invoke("unlock_archive", {
      path,
      password,
      remember,
      storageMode: storageMode ?? null,
      masterPassword: masterPassword ?? null,
    });
  },

  async checkMigration(path: string): Promise<MigrationCandidate | null> {
    return invoke<MigrationCandidate | null>("check_migration", { path });
  },

  async confirmMigration(archiveId: number, newPath: string): Promise<void> {
    await invoke("confirm_migration", { archiveId, newPath });
  },

  async startupCacheCleanup(strategy: CacheCleanupStrategy): Promise<void> {
    await invoke("startup_cache_cleanup", { strategy });
  },
};
