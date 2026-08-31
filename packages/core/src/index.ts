export { AppShell } from "./components/AppShell";
export { BackButton } from "./components/BackButton";
export { DropCoordinator } from "./components/DropCoordinator";
export { default as DropZone } from "./components/DropZone";
export { default as ImageViewer } from "./components/ImageViewer";
export { default as MenuBar } from "./components/MenuBar";
export { default as QuickGalleryPanel } from "./components/QuickGalleryPanel";
export { default as SelectionActionBar } from "./components/SelectionActionBar";
export { default as SelectionPanel } from "./components/SelectionPanel";
export * from "./components/settings";
export * from "./components/ui/alert-dialog";
export * from "./components/ui/badge";
export { Button, buttonVariants } from "./components/ui/button";
export { Checkbox } from "./components/ui/checkbox";
export * from "./components/ui/dialog";
export * from "./components/ui/empty";
export * from "./components/ui/field";
export { Input } from "./components/ui/input";
export {
  NativeSelect,
  NativeSelectOption,
} from "./components/ui/native-select";
export { Progress } from "./components/ui/progress";
export { Switch } from "./components/ui/switch";
export * from "./components/ui/table";
export { Toaster, toast } from "./components/ui/toast";
export * from "./components/ui/tooltip";
export { default as WaterfallGrid } from "./components/WaterfallGrid";
export {
  getPlatform,
  PlatformContext,
  setPlatform,
  usePlatform,
} from "./context/PlatformContext";
export * from "./features/gallery";
export type { Namespace, SupportedLanguage } from "./i18n/index";
export { i18n, setI18nLanguage, useI18n } from "./i18n/index";
export {
  ARCHIVE_EXTENSION_NAMES,
  ARCHIVE_EXTENSIONS,
  isArchiveFileName,
} from "./lib/archiveFormats";
export {
  dedupeDroppedSources,
  libraryEffectForDropBehavior,
  planDroppedOpen,
  resolveDropDisposition,
  routeAcceptsExternalDrop,
} from "./lib/dropPolicy";
export { GITHUB_ISSUES_URL, GITHUB_REPO_URL } from "./lib/projectLinks";
export {
  applyLibraryEffect,
  executeArchiveScan,
  expandLockedArchive,
  incrementalRefresh,
  openFolderAndScan,
  openSources,
  refresh,
  resetToDropZone,
  startArchiveScan,
  startScan,
} from "./lib/scanActions";
export {
  applySuccessfulMoveToSelection,
  coordinateGridAfterMove,
  currentPackageKeys,
  knownPackageRoots,
  visibleSelectableIdentities,
} from "./lib/selectionActions";
export {
  assertBatchMovePlatformContract,
  SELECTION_PLATFORM_METHODS,
  selectionMethodsPresent,
  shouldShowMultiselectEntry,
  shouldShowSelectionChrome,
} from "./lib/selectionContract";
export {
  identityAfterMove,
  isSelectableImage,
  normalizePathKey,
  selectableIdentitiesInRange,
} from "./lib/selectionIdentity";
export { useCoreRuntime } from "./lib/useCoreRuntime";
export {
  EMPTY_SELECTION_STATE,
  MOVE_ITEM_STATUS_NAMES,
  moveItemResultSchema,
  parseMoveItemResults,
  parseSelectableFileProbes,
  parseSelectionState,
  persistedSelectionStateSchema,
  SELECTION_ENTRY_FIELD_NAMES,
  selectableFileIdentitySchema,
} from "./persistence/selectionSchema";
export type { SettingsEnvelope } from "./persistence/settingsSchema";
export {
  createDefaultSettings,
  createSettingsEnvelope,
  migrateSettingsEnvelope,
  SETTINGS_SCHEMA_V1_VERSION,
  SETTINGS_SCHEMA_V2_VERSION,
  SETTINGS_SCHEMA_VERSION,
  settingsEnvelopeSchema,
  settingsSchema,
} from "./persistence/settingsSchema";
export { useDropStore } from "./stores/dropStore";
export { useLibraryStore } from "./stores/libraryStore";
export {
  flushSelectionPersist,
  resetSelectionStore,
  useSelectionStore,
} from "./stores/selectionStore";
export { useSettingsStore } from "./stores/settingsStore";
export {
  resetUpdateStore,
  setUpdateBackend,
  setUpdateProductionBuild,
  useUpdateStore,
} from "./stores/updateStore";
export type {
  ColumnBreakpoints,
  ImageBatch,
  Locale,
  ScanParams,
  SelectableFileIdentity,
  SortMethod,
  Thumbnail,
  WImage,
} from "./types/index";
export type {
  ArchiveInfo,
  CacheCleanupStrategy,
  CachePolicy,
  CacheStats,
  DragDropSubscriptionOptions,
  DropBatch,
  DropListener,
  DropPersistence,
  DroppedSource,
  DropRejection,
  DropRejectionReason,
  ExternalDropBehavior,
  ExtractedMode,
  ExtractedPolicy,
  FolderThumbnailsMode,
  ImageBatch as PlatformImageBatch,
  LibraryAccessStatus,
  LibraryEffect,
  LibrarySource,
  LibrarySourceInput,
  LibrarySourceKind,
  LibrarySourcePatch,
  MigrationCandidate,
  MoveConflictPolicy,
  MoveFilesRequest,
  MoveItemResult,
  MoveProgress,
  PasswordStorageMode,
  PersistedSelectionEntry,
  PersistedSelectionState,
  PlatformCapabilities,
  PlatformService,
  ScanArchiveParams,
  ScanInfoProgress,
  ScanParams as PlatformScanParams,
  ScanThumbProgress,
  SelectableFileProbe,
  SelectionEntryKey,
  Settings,
  SourceOverride,
  ThemePreference,
  ThumbnailPolicy,
  ThumbRetain,
} from "./types/platform";
export {
  DEFAULT_CACHE_POLICY,
  DEFAULT_THUMBNAIL_SIZES,
} from "./types/platform";
export type {
  ArchiveScannerService,
  CacheManagerService,
  DirectoryTreeService,
  FileActionsService,
  FolderPickerService,
  GalleryDisplaySettings,
  GalleryFeatureSettings,
  ImageScannerService,
  ImageUrlService,
  SettingsStorage,
  ThemeSettings,
  ThumbnailService,
} from "./types/services";
export type {
  UpdateBackend,
  UpdateCheckReason,
  UpdateErrorPhase,
  UpdateSnapshot,
  UpdateStatus,
} from "./updates/updateController";
export {
  createUpdateController,
  IDLE_UPDATE_SNAPSHOT,
  isUpdateBusy,
  shouldStartUpdateCheck,
} from "./updates/updateController";
