import type {
  ArchiveInfo,
  CacheCleanupStrategy,
  CachePolicy,
  CacheStats,
  FolderThumbnailsMode,
  ImageBatch,
  MigrationCandidate,
  PasswordStorageMode,
  PlatformService,
  ScanArchiveParams,
  ScanInfoProgress,
  ScanParams,
  ScanThumbProgress,
  Settings,
  SourceOverride,
  Thumbnail,
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

function parseThumbUri(
  thumbId: string,
): { source: string; entry: string; w: string } | null {
  // Expected: mg-thumb:///<sourceHash>/<entryHash>?w=<width>
  const m = thumbId.match(/^mg-thumb:\/\/\/([^/]+)\/([^?]+)\?w=(\d+)/);
  if (!m?.[1] || !m[2] || !m[3]) return null;
  return { source: m[1], entry: m[2], w: m[3] };
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
    onInfoProgress?: (progress: ScanInfoProgress) => void,
    onThumbProgress?: (progress: ScanThumbProgress) => void,
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

    let unlistenInfo: (() => void) | undefined;
    if (onInfoProgress) {
      unlistenInfo = await listen<ScanInfoProgress>(
        "images:info_progress",
        (event) => onInfoProgress(event.payload),
      );
    }

    let unlistenThumb: (() => void) | undefined;
    if (onThumbProgress) {
      unlistenThumb = await listen<ScanThumbProgress>(
        "images:thumb_progress",
        (event) => onThumbProgress(event.payload),
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
        unlistenInfo?.();
        unlistenThumb?.();
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
    return `http://localhost:${cachedServerPort}/image?path=${encodeURIComponent(source)}`;
  },

  getThumbUrl(thumbId: string): string {
    if (cachedServerPort === null) {
      return "";
    }
    const parsed = parseThumbUri(thumbId);
    if (!parsed) return "";
    const { source, entry, w } = parsed;
    return `http://localhost:${cachedServerPort}/thumb?source=${encodeURIComponent(source)}&entry=${encodeURIComponent(entry)}&w=${w}`;
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
    const theme = await store.get<Settings["theme"]>("theme");
    const themePreset = await store.get<Settings["themePreset"]>("themePreset");
    const accentPreset =
      await store.get<Settings["accentPreset"]>("accentPreset");
    const customAccent =
      await store.get<Settings["customAccent"]>("customAccent");
    const customTheme = await store.get<Settings["customTheme"]>("customTheme");
    const breakpoints = await store.get<Settings["breakpoints"]>("breakpoints");
    const showGridPosition = await store.get<boolean>("showGridPosition");
    const confirmDelete = await store.get<boolean>("confirmDelete");
    const showDeleteToast = await store.get<boolean>("showDeleteToast");
    const cacheCleanupStrategy = await store.get<CacheCleanupStrategy>(
      "cacheCleanupStrategy",
    );
    const passwordStorageMode = await store.get<PasswordStorageMode>(
      "passwordStorageMode",
    );
    const cachePolicy = await store.get<CachePolicy>("cachePolicy");
    const thumbnailSizes = await store.get<number[]>("thumbnailSizes");
    const folderThumbnails =
      await store.get<FolderThumbnailsMode>("folderThumbnails");

    return {
      ...(formats != null && { formats }),
      ...(sortMethod != null && { sortMethod }),
      ...(pageSize != null && { pageSize }),
      ...(language != null && { language }),
      ...(theme != null && { theme }),
      ...(themePreset != null && { themePreset }),
      ...(accentPreset != null && { accentPreset }),
      ...(customAccent != null && { customAccent }),
      ...(customTheme != null && { customTheme }),
      ...(breakpoints != null && { breakpoints }),
      ...(showGridPosition != null && { showGridPosition }),
      ...(confirmDelete != null && { confirmDelete }),
      ...(showDeleteToast != null && { showDeleteToast }),
      ...(cacheCleanupStrategy != null && { cacheCleanupStrategy }),
      ...(passwordStorageMode != null && { passwordStorageMode }),
      ...(cachePolicy != null && { cachePolicy }),
      ...(thumbnailSizes != null && { thumbnailSizes }),
      ...(folderThumbnails != null && { folderThumbnails }),
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
    return Array.isArray(selected) ? (selected[0] ?? null) : selected;
  },

  async scanArchive(
    params: ScanArchiveParams,
    onBatch: (batch: ImageBatch) => void,
    onComplete: () => void,
    onCount?: (total: number) => void,
    onInfoProgress?: (progress: ScanInfoProgress) => void,
    onThumbProgress?: (progress: ScanThumbProgress) => void,
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

    let unlistenInfo: (() => void) | undefined;
    if (onInfoProgress) {
      unlistenInfo = await listen<ScanInfoProgress>(
        "images:info_progress",
        (event) => onInfoProgress(event.payload),
      );
    }

    let unlistenThumb: (() => void) | undefined;
    if (onThumbProgress) {
      unlistenThumb = await listen<ScanThumbProgress>(
        "images:thumb_progress",
        (event) => onThumbProgress(event.payload),
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
        unlistenInfo?.();
        unlistenThumb?.();
      }
    });

    await invoke("scan_archive", { params });
  },

  async getArchiveInfo(path: string): Promise<ArchiveInfo> {
    return invoke<ArchiveInfo>("get_archive_info", { path });
  },

  async getCacheStats(): Promise<CacheStats[]> {
    return invoke<CacheStats[]>("get_cache_stats");
  },

  async clearThumbnails(sourceId?: number): Promise<void> {
    await invoke("clear_thumbnails", { sourceId: sourceId ?? null });
  },

  async clearExtracted(sourceId?: number): Promise<void> {
    await invoke("clear_extracted", { sourceId: sourceId ?? null });
  },

  async pinCache(sourceId: number, pinned: boolean): Promise<void> {
    await invoke("pin_cache", { sourceId, pinned });
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

  async confirmMigration(sourceId: number, newPath: string): Promise<void> {
    await invoke("confirm_migration", { sourceId, newPath });
  },

  async startupCacheCleanup(strategy: CacheCleanupStrategy): Promise<void> {
    await invoke("startup_cache_cleanup", { strategy });
  },

  async setCachePolicy(policy: CachePolicy): Promise<void> {
    await invoke("set_cache_policy", { policy });
  },

  async setSourcePolicy(
    sourceId: number,
    override: SourceOverride | null,
  ): Promise<void> {
    await invoke("set_source_policy", {
      sourceId,
      policyOverride: override,
    });
  },

  async requestThumbnail(
    sourceId: number,
    entryPath: string,
    widths?: number[],
  ): Promise<{ enqueued: boolean; skipped: boolean }> {
    const result = await invoke<{
      enqueued: boolean;
      skipped: boolean;
      reason?: string;
    }>("request_thumbnail", {
      params: { sourceId, entryPath, widths: widths ?? [] },
    });
    return { enqueued: result.enqueued, skipped: result.skipped };
  },

  async cancelThumbnail(sourceId: number, entryPath: string): Promise<void> {
    await invoke("cancel_thumbnail", {
      params: { sourceId, entryPath },
    });
  },

  onThumbnailsReady(
    callback: (event: {
      sourceId: number;
      entryPath: string;
      thumbnails: Thumbnail[];
    }) => void,
  ): () => void {
    let unlistenFn: (() => void) | null = null;
    let unsubscribed = false;

    listen<{
      sourceId: number;
      entryPath: string;
      thumbnails: Thumbnail[];
    }>("images:thumbnails", (event) => {
      callback(event.payload);
    }).then((fn) => {
      if (unsubscribed) {
        fn();
      } else {
        unlistenFn = fn;
      }
    });

    return () => {
      unsubscribed = true;
      unlistenFn?.();
    };
  },
};
