import type {
  ArchiveInfo,
  CacheCleanupStrategy,
  CachePolicy,
  CacheStats,
  ImageBatch,
  LibrarySource,
  LibrarySourceInput,
  LibrarySourcePatch,
  MigrationCandidate,
  PasswordStorageMode,
  PlatformService,
  ScanArchiveParams,
  ScanInfoProgress,
  ScanParams,
  ScanThumbProgress,
  SourceOverride,
  Thumbnail,
} from "@mason-gallery/core";
import {
  createDefaultSettings,
  createSettingsEnvelope,
  migrateSettingsEnvelope,
} from "@mason-gallery/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open } from "@tauri-apps/plugin-dialog";
import {
  loadArchiveSecret,
  loadArchiveSecretFromActiveVault,
  saveArchiveSecret,
} from "../persistence/archiveSecrets";

let cachedServerPort: number | null = null;

async function getServerPort(): Promise<number> {
  if (cachedServerPort !== null) return cachedServerPort;
  cachedServerPort = await invoke<number>("get_image_server_port");
  return cachedServerPort;
}

async function pickArchivePaths(multiple: boolean): Promise<string[] | null> {
  const selected = await open({
    multiple,
    filters: [
      {
        name: "Archives",
        extensions: ["zip", "rar", "7z", "cbz", "cbr"],
      },
    ],
  });
  if (!selected) return null;
  return Array.isArray(selected) ? selected : [selected];
}

function parseThumbUri(
  thumbId: string,
): { source: string; entry: string; w: string } | null {
  // Expected: mg-thumb:///<sourceHash>/<entryHash>?w=<width>
  const m = thumbId.match(/^mg-thumb:\/\/\/([^/]+)\/([^?]+)\?w=(\d+)/);
  if (!m?.[1] || !m[2] || !m[3]) return null;
  return { source: m[1], entry: m[2], w: m[3] };
}

interface ScanCallbacks {
  onBatch: (batch: ImageBatch) => void;
  onComplete: () => void;
  onCount?: (total: number) => void;
  onInfoProgress?: (progress: ScanInfoProgress) => void;
  onThumbProgress?: (progress: ScanThumbProgress) => void;
}

let scanQueue: Promise<void> = Promise.resolve();

function withSerializedScan(task: () => Promise<void>): Promise<void> {
  const result = scanQueue.then(task, task);
  scanQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * Tauri scan events are app-global, so overlapping listeners would consume
 * each other's batches. Serialize both folder and archive scans and always
 * release every listener, including command failures.
 */
async function runScanCommand(
  command: "scan_directory" | "scan_archive",
  params: ScanParams | ScanArchiveParams,
  callbacks: ScanCallbacks,
): Promise<void> {
  await getServerPort();

  return withSerializedScan(async () => {
    const cleanups: Array<() => void> = [];
    let resolveDone: (() => void) | undefined;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });

    try {
      if (callbacks.onCount) {
        cleanups.push(
          await listen<{ total: number }>("images:count", (event) => {
            callbacks.onCount?.(event.payload.total);
          }),
        );
      }
      if (callbacks.onInfoProgress) {
        cleanups.push(
          await listen<ScanInfoProgress>("images:info_progress", (event) => {
            callbacks.onInfoProgress?.(event.payload);
          }),
        );
      }
      if (callbacks.onThumbProgress) {
        cleanups.push(
          await listen<ScanThumbProgress>("images:thumb_progress", (event) => {
            callbacks.onThumbProgress?.(event.payload);
          }),
        );
      }
      cleanups.push(
        await listen<ImageBatch>("images:batch", (event) => {
          const batch = event.payload;
          if (batch.images.length > 0) callbacks.onBatch(batch);
          if (batch.done) {
            try {
              callbacks.onComplete();
            } finally {
              resolveDone?.();
            }
          }
        }),
      );

      await Promise.all([invoke(command, { params }), done]);
    } finally {
      for (const cleanup of cleanups) cleanup();
    }
  });
}

export const tauriPlatformService: PlatformService = {
  capabilities: {
    canDeleteFiles: true,
    canRevealFile: true,
    canSelectFolder: true,
    hasCustomTitlebar: true,
    canAutoUpdate: import.meta.env.PROD,
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
    await runScanCommand("scan_directory", params, {
      onBatch,
      onComplete,
      onCount,
      onInfoProgress,
      onThumbProgress,
    });
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
    let disposed = false;

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
        if (disposed) fn();
        else unlistenFn = fn;
      });

    return () => {
      disposed = true;
      unlistenFn?.();
    };
  },

  async loadSettings() {
    const envelope = await invoke<unknown | null>("load_settings");
    return envelope
      ? migrateSettingsEnvelope(envelope).settings
      : createDefaultSettings();
  },

  async saveSettings(settings): Promise<void> {
    await invoke("save_settings", {
      envelope: createSettingsEnvelope(settings),
    });
  },

  async listDirectoryTree(paths: string[]): Promise<string[]> {
    const result = await invoke<{ directories: string[] }>(
      "list_directory_tree",
      { paths },
    );
    return result.directories;
  },

  async pickArchive(): Promise<string | null> {
    const selected = await pickArchivePaths(false);
    return selected?.[0] ?? null;
  },

  async pickArchives(): Promise<string[] | null> {
    return pickArchivePaths(true);
  },

  async scanArchive(
    params: ScanArchiveParams,
    onBatch: (batch: ImageBatch) => void,
    onComplete: () => void,
    onCount?: (total: number) => void,
    onInfoProgress?: (progress: ScanInfoProgress) => void,
    onThumbProgress?: (progress: ScanThumbProgress) => void,
  ): Promise<void> {
    await runScanCommand("scan_archive", params, {
      onBatch,
      onComplete,
      onCount,
      onInfoProgress,
      onThumbProgress,
    });
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
    await invoke("unlock_archive", { path, password });

    if (!remember || storageMode !== "master") return;
    await saveArchiveSecret(path, password, masterPassword);
    await invoke("mark_archive_secret_stored", {
      path,
      vaultKey: path,
    });
  },

  async requiresMasterPassword(path: string): Promise<boolean> {
    const required = await invoke<boolean>("requires_master_password", {
      path,
    });
    if (!required) return false;

    const vaultKey = await invoke<string | null>("get_archive_secret_ref", {
      path,
    });
    if (!vaultKey) return false;
    const activePassword = await loadArchiveSecretFromActiveVault(vaultKey);
    if (!activePassword) return true;

    await invoke("unlock_archive", { path, password: activePassword });
    return false;
  },

  async unlockArchiveWithMasterPassword(
    path: string,
    masterPassword: string,
  ): Promise<void> {
    const vaultKey = await invoke<string | null>("get_archive_secret_ref", {
      path,
    });
    if (!vaultKey) throw new Error("MasterPasswordNotStored");

    let password: string | null;
    try {
      password = await loadArchiveSecret(vaultKey, masterPassword);
    } catch {
      throw new Error("WrongMasterPassword");
    }
    if (!password) throw new Error("MasterPasswordNotStored");

    await invoke("unlock_archive", { path, password });
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

  async listLibrarySources(): Promise<LibrarySource[]> {
    return invoke<LibrarySource[]>("list_library_sources");
  },

  async addLibrarySources(
    sources: LibrarySourceInput[],
  ): Promise<LibrarySource[]> {
    return invoke<LibrarySource[]>("add_library_sources", { sources });
  },

  async updateLibrarySource(
    id: number,
    patch: LibrarySourcePatch,
  ): Promise<LibrarySource[]> {
    return invoke<LibrarySource[]>("update_library_source", { id, patch });
  },

  async removeLibrarySources(ids: number[]): Promise<LibrarySource[]> {
    return invoke<LibrarySource[]>("remove_library_sources", { ids });
  },

  async markLibrarySourcesScanned(
    paths: string[],
    imageCount?: number,
  ): Promise<void> {
    await invoke("mark_library_sources_scanned", {
      paths,
      imageCount: imageCount ?? null,
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
