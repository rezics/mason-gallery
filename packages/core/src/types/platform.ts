import type { ColumnBreakpoints, Locale, SortMethod } from "./index";

export interface Settings {
  formats: string[];
  sortMethod: SortMethod;
  pageSize: number;
  language: Locale;
  breakpoints: ColumnBreakpoints;
  showGridPosition: boolean;
  confirmDelete: boolean;
  showDeleteToast: boolean;
}

export interface ScanParams {
  paths: string[];
  formats: string[];
  page_size: number;
  sort_method: SortMethod;
}

export interface ImageBatch {
  images: Array<{
    source: string;
    relativePath: string;
    width: number | null;
    height: number | null;
  }>;
  done: boolean;
}

export interface PlatformCapabilities {
  canDeleteFiles: boolean;
  canRevealFile: boolean;
  canSelectFolder: boolean;
  hasCustomTitlebar: boolean;
  canAutoUpdate: boolean;
  canDragDropFolders: boolean;
  canBrowseArchives: boolean;
}

export type PasswordStorageMode = "none" | "plaintext" | "master";
export type CacheCleanupStrategy = "auto-clean" | "keep-all";

export interface ArchiveInfo {
  format: string;
  entryCount: number;
  totalSize: number;
  isSolid: boolean;
  isEncrypted: boolean;
}

export interface CacheStats {
  id: number;
  archivePath: string;
  filename: string;
  entryCount: number | null;
  cacheSize: number;
  isPinned: boolean;
  lastAccessed: string | null;
}

export interface ScanArchiveParams {
  path: string;
  formats: string[];
  pageSize: number;
  sortMethod: string;
  password?: string;
}

export interface MigrationCandidate {
  archiveId: number;
  oldPath: string;
  matchScore: number;
}

export interface PlatformService {
  capabilities: PlatformCapabilities;

  scanImages(
    params: ScanParams,
    onBatch: (batch: ImageBatch) => void,
    onComplete: () => void,
    onCount?: (total: number) => void,
  ): Promise<void>;

  getImageUrl(source: string): string;

  deleteFile(path: string): Promise<void>;

  revealFile(path: string): Promise<void>;

  pickFolders(): Promise<string[] | null>;

  onDragDrop(callback: (paths: string[]) => void): () => void;

  loadSettings(): Promise<Partial<Settings>>;

  saveSettings(key: string, value: unknown): Promise<void>;

  listDirectoryTree(paths: string[]): Promise<string[]>;

  // Archive operations (desktop-only)
  pickArchive?(): Promise<string | null>;
  scanArchive?(
    params: ScanArchiveParams,
    onBatch: (batch: ImageBatch) => void,
    onComplete: () => void,
    onCount?: (total: number) => void,
  ): Promise<void>;
  extractArchiveEntry?(uri: string): Promise<string>;
  getArchiveInfo?(path: string): Promise<ArchiveInfo>;
  getCacheStats?(): Promise<CacheStats[]>;
  clearCache?(archiveId?: number): Promise<void>;
  pinCache?(archiveId: number, pinned: boolean): Promise<void>;
  unlockArchive?(
    path: string,
    password: string,
    remember: boolean,
    storageMode?: PasswordStorageMode,
    masterPassword?: string,
  ): Promise<void>;
  checkMigration?(path: string): Promise<MigrationCandidate | null>;
  confirmMigration?(archiveId: number, newPath: string): Promise<void>;
  startupCacheCleanup?(strategy: CacheCleanupStrategy): Promise<void>;
}
