import type { ColumnBreakpoints, Locale, SortMethod } from "./index";
import type {
  ArchiveInfo,
  CacheCleanupStrategy,
  CachePolicy,
  CacheStats,
  ImageBatch,
  MigrationCandidate,
  PasswordStorageMode,
  ScanArchiveParams,
  ScanInfoProgress,
  ScanParams,
  ScanThumbProgress,
  Settings,
  SourceOverride,
  Thumbnail,
} from "./platform";

export interface ThemeSettings {
  language: Locale;
  theme: Settings["theme"];
}

export interface GalleryDisplaySettings {
  sortMethod: SortMethod;
  pageSize: number;
  breakpoints: ColumnBreakpoints;
  showGridPosition: boolean;
  openGallerySidebarByDefault: boolean;
}

export interface GalleryFeatureSettings
  extends ThemeSettings,
    GalleryDisplaySettings {
  formats: string[];
}

export interface SettingsStorage<TSettings extends object> {
  loadSettings(): Promise<TSettings>;
  saveSettings(settings: TSettings): Promise<void>;
}

export interface ImageScannerService {
  scanImages(
    params: ScanParams,
    onBatch: (batch: ImageBatch) => void,
    onComplete: () => void,
    onCount?: (total: number) => void,
    onInfoProgress?: (progress: ScanInfoProgress) => void,
    onThumbProgress?: (progress: ScanThumbProgress) => void,
  ): Promise<void>;
}

export interface ImageUrlService {
  getImageUrl(source: string): string;
  getThumbUrl(thumbId: string): string;
}

export interface FolderPickerService {
  pickFolders(): Promise<string[] | null>;
  onDragDrop(callback: (paths: string[]) => void): () => void;
}

export interface DirectoryTreeService {
  listDirectoryTree(paths: string[]): Promise<string[]>;
}

export interface FileActionsService {
  deleteFile(path: string): Promise<void>;
  revealFile(path: string): Promise<void>;
}

export interface ArchiveScannerService {
  pickArchive(): Promise<string | null>;
  scanArchive(
    params: ScanArchiveParams,
    onBatch: (batch: ImageBatch) => void,
    onComplete: () => void,
    onCount?: (total: number) => void,
    onInfoProgress?: (progress: ScanInfoProgress) => void,
    onThumbProgress?: (progress: ScanThumbProgress) => void,
  ): Promise<void>;
  getArchiveInfo(path: string): Promise<ArchiveInfo>;
  unlockArchive(
    path: string,
    password: string,
    remember: boolean,
    storageMode?: PasswordStorageMode,
    masterPassword?: string,
  ): Promise<void>;
  requiresMasterPassword(path: string): Promise<boolean>;
  unlockArchiveWithMasterPassword(
    path: string,
    masterPassword: string,
  ): Promise<void>;
  checkMigration(path: string): Promise<MigrationCandidate | null>;
  confirmMigration(sourceId: number, newPath: string): Promise<void>;
}

export interface CacheManagerService {
  getCacheStats(): Promise<CacheStats[]>;
  clearThumbnails(sourceId?: number): Promise<void>;
  clearExtracted(sourceId?: number): Promise<void>;
  pinCache(sourceId: number, pinned: boolean): Promise<void>;
  startupCacheCleanup(strategy: CacheCleanupStrategy): Promise<void>;
  setCachePolicy(policy: CachePolicy): Promise<void>;
  setSourcePolicy(
    sourceId: number,
    override: SourceOverride | null,
  ): Promise<void>;
}

export interface ThumbnailService {
  requestThumbnail(
    sourceId: number,
    entryPath: string,
    widths?: number[],
  ): Promise<{ enqueued: boolean; skipped: boolean }>;
  cancelThumbnail(sourceId: number, entryPath: string): Promise<void>;
  onThumbnailsReady(
    callback: (event: {
      sourceId: number;
      entryPath: string;
      thumbnails: Thumbnail[];
    }) => void,
  ): () => void;
}
