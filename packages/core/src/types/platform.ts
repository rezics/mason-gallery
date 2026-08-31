import type {
  ColumnBreakpoints,
  Locale,
  SelectableFileIdentity,
  SortMethod,
  Thumbnail,
} from "./index";

export type { Thumbnail };

export type ExtractedMode = "no-cache" | "lru-capped" | "unlimited";
export type ThumbRetain = "until-source-removed" | "lru-capped";

export interface ExtractedPolicy {
  mode: ExtractedMode;
  maxSizePerSource?: number;
  minFileSize?: number;
}

export interface ThumbnailPolicy {
  retain: ThumbRetain;
  maxTotalSize?: number;
}

export interface CachePolicy {
  extracted: ExtractedPolicy;
  thumbnails: ThumbnailPolicy;
  /**
   * Thumbnail widths generated at scan time. The Rust backend resolves per-
   * source `SourceOverride.thumbnails.widths` on top of this; the frontend
   * never passes a widths array through the scan call itself.
   */
  thumbnailSizes: number[];
}

export interface SourceThumbnailOverride extends Partial<ThumbnailPolicy> {
  /**
   * Override the thumbnail widths for this specific source. When set it
   * replaces `CachePolicy.thumbnailSizes` wholesale; unset means "inherit
   * global". Must contain at least one value — the backend rejects empty
   * arrays in `setSourcePolicy`.
   */
  widths?: number[];
}

export type SourceOverride = {
  extracted?: Partial<ExtractedPolicy>;
  thumbnails?: SourceThumbnailOverride;
};

export const DEFAULT_THUMBNAIL_SIZES = [800];

export const DEFAULT_CACHE_POLICY: CachePolicy = {
  extracted: { mode: "unlimited" },
  thumbnails: { retain: "until-source-removed" },
  thumbnailSizes: DEFAULT_THUMBNAIL_SIZES,
};

export type FolderThumbnailsMode = "off" | "lazy";

export type ThemePreference = "system" | "light" | "dark";

export interface GallerySourceShortcut {
  kind: "folder" | "archive";
  path: string;
  label: string;
  lastOpenedAt: string;
}

export type ExternalDropBehavior = "add-and-open" | "open-only";
export type LibraryEffect = "ensure" | "touch" | "none";
export type DropPersistence = "durable" | "session";
export type DropRejectionReason =
  | "unsupported-type"
  | "unsupported-platform"
  | "missing"
  | "permission-denied";

export type DroppedSource =
  | { kind: "folder"; locator: string; label: string }
  | { kind: "archive"; locator: string; label: string };

export interface DropRejection {
  label: string;
  reason: DropRejectionReason;
}

export interface DropBatch {
  accepted: DroppedSource[];
  rejected: DropRejection[];
}

export interface DropHoverPosition {
  x: number;
  y: number;
}

export interface DropListener {
  /**
   * Called synchronously on dragover / hover. Web only calls
   * `preventDefault()` when this returns true.
   */
  accepts(): boolean;
  /** Web uses this to choose IndexedDB vs in-memory session handles. */
  persistence(): DropPersistence;
  onOver?(position?: DropHoverPosition): void;
  onDrop(batch: DropBatch): void;
  onCancel?(): void;
}

export interface DragDropSubscriptionOptions {
  /** Web: listen on this node instead of `document`. */
  target?: EventTarget | null;
}

export type LibrarySourceKind = "folder" | "archive";
export type LibraryAccessStatus = "ready" | "needs-access" | "missing";

/** A durable gallery registered in the user's library. */
export interface LibrarySource {
  id: number;
  kind: LibrarySourceKind;
  path: string;
  label: string;
  isFavorite: boolean;
  addedAt: string;
  lastOpenedAt: string | null;
  lastScannedAt: string | null;
  imageCount: number | null;
  accessStatus: LibraryAccessStatus;
}

export interface LibrarySourceInput {
  kind: LibrarySourceKind;
  path: string;
  label?: string;
  lastOpenedAt?: string | null;
}

export interface LibrarySourcePatch {
  label?: string;
  isFavorite?: boolean;
}

export interface Settings {
  formats: string[];
  sortMethod: SortMethod;
  pageSize: number;
  language: Locale;
  theme: ThemePreference;
  breakpoints: ColumnBreakpoints;
  showGridPosition: boolean;
  openGallerySidebarByDefault: boolean;
  confirmDelete: boolean;
  showDeleteToast: boolean;
  cacheCleanupStrategy: CacheCleanupStrategy;
  passwordStorageMode: PasswordStorageMode;
  cachePolicy: CachePolicy;
  folderThumbnails: FolderThumbnailsMode;
  recentSources: GallerySourceShortcut[];
  favoriteSources: GallerySourceShortcut[];
  autoCheckUpdates: boolean;
  externalDropBehavior: ExternalDropBehavior;
}

export interface ScanParams {
  paths: string[];
  formats: string[];
  page_size: number;
  sort_method: SortMethod;
  /**
   * Preserve currently displayed image URLs until a refresh scan completes.
   * Platforms with revocable object URLs can use this to avoid breaking the
   * rendered grid while they rescan the same source.
   */
  preserveExistingUrls?: boolean;
}

export interface ImageBatch {
  images: Array<{
    source: string;
    relativePath: string;
    width: number | null;
    height: number | null;
    thumbnails?: Thumbnail[];
    sourceId?: number;
    locked?: boolean;
    selectableFile?: SelectableFileIdentity;
  }>;
  done: boolean;
}

/**
 * Per-entry indicator: how many entries the masonry grid can render now.
 * For loose files, an entry is "loaded" once dimensions are probed; for
 * archive entries, only after the thumbnail file is on disk (since the
 * grid renders the thumbnail URL).
 */
export interface ScanInfoProgress {
  loaded: number;
  total: number;
}

/**
 * Per-entry indicator: how many entries have a thumbnail file written to
 * disk during the scan. Loose files don't auto-thumbnail (those go through
 * the lazy pipeline), so for loose-only scans this stays at 0/0.
 */
export interface ScanThumbProgress {
  generated: number;
  total: number;
}

export interface PlatformCapabilities {
  canDeleteFiles: boolean;
  canRevealFile: boolean;
  canSelectFolder: boolean;
  hasCustomTitlebar: boolean;
  canAutoUpdate: boolean;
  canDragDropFolders: boolean;
  canBrowseArchives: boolean;
  canBatchMoveFiles: boolean;
}

export interface PersistedSelectionEntry extends SelectableFileIdentity {
  selectedAt: string;
  lastSeenAt: string | null;
}

export interface PersistedSelectionState {
  modeEnabled: boolean;
  entries: PersistedSelectionEntry[];
}

export interface SelectionEntryKey {
  packageKey: string;
  entryKey: string;
}

export type MoveConflictPolicy = "keep-both" | "skip";

export interface MoveFilesRequestItem {
  entryKey: string;
  sourcePath: string;
}

export interface MoveFilesRequest {
  operationId: string;
  destinationDirectory: string;
  conflictPolicy: MoveConflictPolicy;
  items: MoveFilesRequestItem[];
}

export interface MoveProgress {
  operationId: string;
  completed: number;
  total: number;
  succeeded: number;
  skipped: number;
  failed: number;
}

export type MoveItemResult =
  | {
      status: "moved";
      entryKey: string;
      sourcePath: string;
      destinationPath: string;
    }
  | {
      status: "skipped";
      entryKey: string;
      sourcePath: string;
      reason: "conflict" | "same-location" | "cancelled";
    }
  | {
      status: "copied-not-removed";
      entryKey: string;
      sourcePath: string;
      destinationPath: string;
      message: string;
    }
  | {
      status: "failed";
      entryKey: string;
      sourcePath: string;
      code:
        | "missing"
        | "permission-denied"
        | "invalid-source"
        | "invalid-destination"
        | "io";
      message: string;
    };

export interface SelectableFileProbe {
  locator: string;
  available: boolean;
}

export type PasswordStorageMode = "none" | "master";
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
  kind: "archive" | "folder";
  originPath: string;
  identitySegment: string;
  entryCount: number | null;
  thumbCacheSize: number;
  extractedCacheSize: number;
  isPinned: boolean;
  lastAccessed: string | null;
  policyOverride?: string | null;
}

export interface ScanArchiveParams {
  path: string;
  formats: string[];
  pageSize: number;
  sortMethod: string;
  password?: string;
}

export interface MigrationCandidate {
  sourceId: number;
  oldPath: string;
  kind: "archive" | "folder";
  matchScore: number;
}

export interface PlatformService {
  capabilities: PlatformCapabilities;

  scanImages(
    params: ScanParams,
    onBatch: (batch: ImageBatch) => void,
    onComplete: () => void,
    onCount?: (total: number) => void,
    onInfoProgress?: (progress: ScanInfoProgress) => void,
    onThumbProgress?: (progress: ScanThumbProgress) => void,
  ): Promise<void>;

  getImageUrl(source: string): string;

  /**
   * Translate a thumbnail URI (`mg-thumb:///<sourceHash>/<entryHash>?w=<width>`)
   * into an actual fetchable URL. Returns an empty string on platforms that
   * don't serve thumbnails (web).
   */
  getThumbUrl(thumbId: string): string;

  deleteFile?(path: string): Promise<void>;

  revealFile?(path: string): Promise<void>;

  pickFolders(): Promise<string[] | null>;

  onDragDrop(
    listener: DropListener,
    options?: DragDropSubscriptionOptions,
  ): () => void;

  loadSettings(): Promise<Settings>;

  saveSettings(settings: Settings): Promise<void>;

  /**
   * Open a URL in the system browser. Desktop uses Tauri Opener;
   * other targets fall back to `window.open`.
   */
  openExternalUrl?(url: string): Promise<void>;

  listDirectoryTree(paths: string[]): Promise<string[]>;

  // Archive operations (desktop-only)
  pickArchive?(): Promise<string | null>;
  pickArchives?(): Promise<string[] | null>;
  scanArchive?(
    params: ScanArchiveParams,
    onBatch: (batch: ImageBatch) => void,
    onComplete: () => void,
    onCount?: (total: number) => void,
    onInfoProgress?: (progress: ScanInfoProgress) => void,
    onThumbProgress?: (progress: ScanThumbProgress) => void,
  ): Promise<void>;
  getArchiveInfo?(path: string): Promise<ArchiveInfo>;
  getCacheStats?(): Promise<CacheStats[]>;
  clearThumbnails?(sourceId?: number): Promise<void>;
  clearExtracted?(sourceId?: number): Promise<void>;
  pinCache?(sourceId: number, pinned: boolean): Promise<void>;
  unlockArchive?(
    path: string,
    password: string,
    remember: boolean,
    storageMode?: PasswordStorageMode,
    masterPassword?: string,
  ): Promise<void>;
  requiresMasterPassword?(path: string): Promise<boolean>;
  unlockArchiveWithMasterPassword?(
    path: string,
    masterPassword: string,
  ): Promise<void>;
  checkMigration?(path: string): Promise<MigrationCandidate | null>;
  confirmMigration?(sourceId: number, newPath: string): Promise<void>;
  startupCacheCleanup?(strategy: CacheCleanupStrategy): Promise<void>;
  setCachePolicy?(policy: CachePolicy): Promise<void>;
  setSourcePolicy?(
    sourceId: number,
    override: SourceOverride | null,
  ): Promise<void>;

  // Durable gallery-library operations.
  listLibrarySources?(): Promise<LibrarySource[]>;
  addLibrarySources?(sources: LibrarySourceInput[]): Promise<LibrarySource[]>;
  updateLibrarySource?(
    id: number,
    patch: LibrarySourcePatch,
  ): Promise<LibrarySource[]>;
  removeLibrarySources?(ids: number[]): Promise<LibrarySource[]>;
  markLibrarySourcesScanned?(
    paths: string[],
    imageCount?: number,
  ): Promise<void>;

  /**
   * Request on-demand thumbnail generation for a folder entry. Returns
   * `{ enqueued: true }` when a new task was queued, `{ enqueued: false }` if
   * the entry is already cached or already queued, and `{ skipped: true }` if
   * the file is below the minFileSize threshold (no thumbs will ever arrive).
   */
  requestThumbnail?(
    sourceId: number,
    entryPath: string,
    widths?: number[],
  ): Promise<{ enqueued: boolean; skipped: boolean }>;

  /**
   * Cancel a pending or in-flight thumbnail request. Safe to call even if no
   * request is outstanding.
   */
  cancelThumbnail?(sourceId: number, entryPath: string): Promise<void>;

  /**
   * Subscribe to thumbnail-ready events. Returns an unsubscribe function.
   * On the web platform this is a no-op that returns a no-op unsubscribe.
   */
  onThumbnailsReady?(
    callback: (event: {
      sourceId: number;
      entryPath: string;
      thumbnails: Thumbnail[];
    }) => void,
  ): () => void;

  // Persistent multi-select + batch move (desktop-only).
  loadSelectionState?(): Promise<PersistedSelectionState>;
  saveSelectionMode?(enabled: boolean): Promise<void>;
  upsertSelectionEntries?(entries: PersistedSelectionEntry[]): Promise<void>;
  removeSelectionEntries?(keys: SelectionEntryKey[]): Promise<void>;
  clearSelectionPackage?(packageKey: string): Promise<void>;
  clearAllSelections?(): Promise<void>;
  replaceSelectionEntries?(
    remove: SelectionEntryKey[],
    insert: PersistedSelectionEntry[],
  ): Promise<void>;
  commitSelectionMutation?(mutation: {
    modeEnabled?: boolean;
    upsert: PersistedSelectionEntry[];
    remove: SelectionEntryKey[];
  }): Promise<void>;
  probeSelectableFiles?(locators: string[]): Promise<SelectableFileProbe[]>;
  pickMoveDestination?(): Promise<string | null>;
  moveFiles?(
    request: MoveFilesRequest,
    onProgress?: (progress: MoveProgress) => void,
  ): Promise<MoveItemResult[]>;
  cancelMoveFiles?(operationId: string): Promise<void>;
}
