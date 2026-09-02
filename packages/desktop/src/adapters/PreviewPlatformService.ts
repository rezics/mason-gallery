import {
  type CacheStats,
  createDefaultSettings,
  type LibrarySource,
  type LibrarySourceInput,
  type LibrarySourcePatch,
  type MoveFilesRequest,
  type MoveItemResult,
  type MoveProgress,
  type PersistedSelectionEntry,
  type PlatformService,
  type SelectableFileProbe,
  type SelectionEntryKey,
  type Settings,
  type SourceOverride,
} from "@mason-gallery/core";

let settings = createDefaultSettings();
let previewIntegrationSelection = { folders: false, archives: false };
let librarySources: LibrarySource[] = [
  {
    id: 1,
    kind: "folder",
    path: "D:\\Pictures\\Photography",
    label: "Photography",
    isFavorite: true,
    addedAt: "2026-06-14T09:30:00Z",
    lastOpenedAt: "2026-08-29T16:42:00Z",
    lastScannedAt: "2026-08-29T16:42:00Z",
    imageCount: 1248,
    accessStatus: "ready",
  },
  {
    id: 2,
    kind: "archive",
    path: "D:\\Comics\\Moonlight-Vol-01.cbz",
    label: "Moonlight · Vol. 01",
    isFavorite: true,
    addedAt: "2026-07-02T10:10:00Z",
    lastOpenedAt: "2026-08-27T08:18:00Z",
    lastScannedAt: "2026-08-27T08:18:00Z",
    imageCount: 186,
    accessStatus: "ready",
  },
  {
    id: 3,
    kind: "folder",
    path: "E:\\References\\Architecture",
    label: "Architecture references",
    isFavorite: false,
    addedAt: "2026-07-18T12:00:00Z",
    lastOpenedAt: "2026-08-22T14:25:00Z",
    lastScannedAt: "2026-08-22T14:25:00Z",
    imageCount: 672,
    accessStatus: "ready",
  },
  {
    id: 4,
    kind: "archive",
    path: "E:\\Archives\\Travel-2024.zip",
    label: "Travel 2024",
    isFavorite: false,
    addedAt: "2026-08-01T17:20:00Z",
    lastOpenedAt: null,
    lastScannedAt: null,
    imageCount: null,
    accessStatus: "missing",
  },
  {
    id: 5,
    kind: "folder",
    path: "D:\\Pictures\\Screenshots",
    label: "Screenshots",
    isFavorite: false,
    addedAt: "2026-08-10T11:45:00Z",
    lastOpenedAt: "2026-08-18T09:12:00Z",
    lastScannedAt: "2026-08-18T09:12:00Z",
    imageCount: 324,
    accessStatus: "ready",
  },
];

let cacheStats: CacheStats[] = [
  {
    id: 21,
    kind: "folder",
    originPath: "D:\\Pictures\\Photography",
    identitySegment: "photography",
    entryCount: 1248,
    thumbCacheSize: 218_103_808,
    extractedCacheSize: 0,
    isPinned: true,
    lastAccessed: "2026-08-29T16:42:00Z",
    policyOverride: null,
  },
  {
    id: 22,
    kind: "archive",
    originPath: "D:\\Comics\\Moonlight-Vol-01.cbz",
    identitySegment: "moonlight",
    entryCount: 186,
    thumbCacheSize: 48_234_496,
    extractedCacheSize: 312_475_648,
    isPinned: true,
    lastAccessed: "2026-08-27T08:18:00Z",
    policyOverride: JSON.stringify({
      extracted: { mode: "lru-capped", maxSizePerSource: 536_870_912 },
    }),
  },
  {
    id: 23,
    kind: "folder",
    originPath: "E:\\References\\Architecture",
    identitySegment: "architecture",
    entryCount: 672,
    thumbCacheSize: 96_731_136,
    extractedCacheSize: 0,
    isPinned: false,
    lastAccessed: "2026-08-22T14:25:00Z",
    policyOverride: null,
  },
  {
    id: 24,
    kind: "archive",
    originPath: "E:\\Archives\\Illustration-Pack.7z",
    identitySegment: "illustration",
    entryCount: 408,
    thumbCacheSize: 75_497_472,
    extractedCacheSize: 641_728_512,
    isPinned: false,
    lastAccessed: "2026-08-12T10:05:00Z",
    policyOverride: null,
  },
];

function copyLibrary(): LibrarySource[] {
  return librarySources.map((source) => ({ ...source }));
}

function copyCache(): CacheStats[] {
  return cacheStats.map((source) => ({ ...source }));
}

let selectionMode = false;
let selectionEntries: PersistedSelectionEntry[] = [];
const previewOccupied = new Set<string>();

function selectionKey(entry: { packageKey: string; entryKey: string }): string {
  return `${entry.packageKey}\0${entry.entryKey}`;
}

function keepBothPath(destDir: string, fileName: string): string {
  const slash = destDir.endsWith("/") || destDir.endsWith("\\") ? "" : "\\";
  const base = `${destDir}${slash}${fileName}`;
  if (!previewOccupied.has(base.toLowerCase())) return base;
  const dot = fileName.lastIndexOf(".");
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : "";
  for (let n = 1; n < 10_000; n += 1) {
    const candidate = `${destDir}${slash}${stem} (${n})${ext}`;
    if (!previewOccupied.has(candidate.toLowerCase())) return candidate;
  }
  return `${destDir}${slash}${stem} (1)${ext}`;
}

export const previewPlatformService: PlatformService = {
  capabilities: {
    canDeleteFiles: true,
    canRevealFile: true,
    canSelectFolder: true,
    hasCustomTitlebar: true,
    canAutoUpdate: false,
    canDragDropFolders: true,
    canBrowseArchives: true,
    canBatchMoveFiles: true,
    hasSystemIntegration: true,
  },
  async scanImages(_params, onBatch, onComplete, onCount) {
    onCount?.(0);
    onBatch({ images: [], done: true });
    onComplete();
  },
  getImageUrl: (source) => source,
  getThumbUrl: () => "",
  pickFolders: async () => [
    "D:\\Pictures\\Editorial references",
    "E:\\Collections\\Comics 2026",
  ],
  pickArchive: async () => null,
  pickArchives: async () => [
    "E:\\Archives\\Art-Book-01.cbz",
    "E:\\Archives\\Sketch-Pack.zip",
  ],
  onDragDrop: () => () => {},
  loadSettings: async () => ({ ...settings }),
  saveSettings: async (next: Settings) => {
    settings = next;
  },
  openExternalUrl: async (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  },
  getSystemIntegrationStatus: async () => ({
    platform: "windows",
    folders: {
      state: previewIntegrationSelection.folders ? "enabled" : "disabled",
      configurable: true,
    },
    archives: {
      state: previewIntegrationSelection.archives ? "enabled" : "disabled",
      configurable: true,
    },
  }),
  setSystemIntegration: async (selection) => {
    previewIntegrationSelection = selection;
    return {
      platform: "windows",
      folders: {
        state: selection.folders ? "enabled" : "disabled",
        configurable: true,
      },
      archives: {
        state: selection.archives ? "enabled" : "disabled",
        configurable: true,
      },
    };
  },
  listDirectoryTree: async () => [],
  scanArchive: async (_params, onBatch, onComplete, onCount) => {
    onCount?.(0);
    onBatch({ images: [], done: true });
    onComplete();
  },
  getCacheStats: async () => copyCache(),
  clearThumbnails: async (sourceId) => {
    cacheStats = cacheStats.map((source) =>
      sourceId == null || source.id === sourceId
        ? { ...source, thumbCacheSize: 0 }
        : source,
    );
  },
  clearExtracted: async (sourceId) => {
    cacheStats = cacheStats.map((source) =>
      sourceId == null || source.id === sourceId
        ? { ...source, extractedCacheSize: 0 }
        : source,
    );
  },
  pinCache: async (sourceId, pinned) => {
    cacheStats = cacheStats.map((source) =>
      source.id === sourceId ? { ...source, isPinned: pinned } : source,
    );
  },
  setSourcePolicy: async (
    sourceId: number,
    override: SourceOverride | null,
  ) => {
    cacheStats = cacheStats.map((source) =>
      source.id === sourceId
        ? {
            ...source,
            policyOverride: override ? JSON.stringify(override) : null,
          }
        : source,
    );
  },
  startupCacheCleanup: async () => {},
  listLibrarySources: async () => copyLibrary(),
  addLibrarySources: async (sources: LibrarySourceInput[]) => {
    let nextId =
      librarySources.reduce(
        (maximum, source) => Math.max(maximum, source.id),
        0,
      ) + 1;
    for (const source of sources) {
      if (
        librarySources.some(
          (item) => item.kind === source.kind && item.path === source.path,
        )
      ) {
        continue;
      }
      librarySources.push({
        id: nextId,
        kind: source.kind,
        path: source.path,
        label: source.label ?? source.path,
        isFavorite: false,
        addedAt: new Date().toISOString(),
        lastOpenedAt: source.lastOpenedAt ?? null,
        lastScannedAt: null,
        imageCount: null,
        accessStatus: "ready",
      });
      nextId += 1;
    }
    return copyLibrary();
  },
  updateLibrarySource: async (id: number, patch: LibrarySourcePatch) => {
    librarySources = librarySources.map((source) =>
      source.id === id ? { ...source, ...patch } : source,
    );
    return copyLibrary();
  },
  removeLibrarySources: async (ids: number[]) => {
    const removed = new Set(ids);
    librarySources = librarySources.filter((source) => !removed.has(source.id));
    return copyLibrary();
  },
  markLibrarySourcesScanned: async () => {},
  onThumbnailsReady: () => () => {},
  loadSelectionState: async () => ({
    modeEnabled: selectionMode,
    entries: selectionEntries.map((entry) => ({ ...entry })),
  }),
  saveSelectionMode: async (enabled: boolean) => {
    selectionMode = enabled;
  },
  upsertSelectionEntries: async (entries: PersistedSelectionEntry[]) => {
    const next = new Map(
      selectionEntries.map((entry) => [selectionKey(entry), entry]),
    );
    for (const entry of entries) next.set(selectionKey(entry), { ...entry });
    selectionEntries = [...next.values()];
  },
  removeSelectionEntries: async (keys: SelectionEntryKey[]) => {
    const remove = new Set(keys.map(selectionKey));
    selectionEntries = selectionEntries.filter(
      (entry) => !remove.has(selectionKey(entry)),
    );
  },
  clearSelectionPackage: async (packageKey: string) => {
    selectionEntries = selectionEntries.filter(
      (entry) => entry.packageKey !== packageKey,
    );
  },
  clearAllSelections: async () => {
    selectionEntries = [];
  },
  replaceSelectionEntries: async (
    remove: SelectionEntryKey[],
    insert: PersistedSelectionEntry[],
  ) => {
    const drop = new Set(remove.map(selectionKey));
    const next = new Map(
      selectionEntries
        .filter((entry) => !drop.has(selectionKey(entry)))
        .map((entry) => [selectionKey(entry), entry]),
    );
    for (const entry of insert) next.set(selectionKey(entry), { ...entry });
    selectionEntries = [...next.values()];
  },
  commitSelectionMutation: async (mutation: {
    modeEnabled?: boolean;
    upsert: PersistedSelectionEntry[];
    remove: SelectionEntryKey[];
  }) => {
    if (mutation.modeEnabled !== undefined) {
      selectionMode = mutation.modeEnabled;
    }
    await previewPlatformService.replaceSelectionEntries?.(
      mutation.remove,
      mutation.upsert,
    );
  },
  probeSelectableFiles: async (
    locators: string[],
  ): Promise<SelectableFileProbe[]> =>
    locators.map((locator) => ({ locator, available: true })),
  pickMoveDestination: async () => "D:\\Pictures\\Sorted",
  moveFiles: async (
    request: MoveFilesRequest,
    onProgress?: (progress: MoveProgress) => void,
  ): Promise<MoveItemResult[]> => {
    const results: MoveItemResult[] = [];
    let succeeded = 0;
    let skipped = 0;
    const failed = 0;
    for (const [index, item] of request.items.entries()) {
      const fileName = item.sourcePath.split(/[\\/]/).pop() || item.sourcePath;
      const sourceDir = item.sourcePath.slice(
        0,
        item.sourcePath.length - fileName.length,
      );
      const destNorm = request.destinationDirectory
        .replace(/\\/g, "/")
        .replace(/\/+$/, "");
      const sourceNorm = sourceDir.replace(/\\/g, "/").replace(/\/+$/, "");
      if (destNorm.toLowerCase() === sourceNorm.toLowerCase()) {
        results.push({
          status: "skipped",
          entryKey: item.entryKey,
          sourcePath: item.sourcePath,
          reason: "same-location",
        });
        skipped += 1;
      } else {
        const originalDest = `${request.destinationDirectory}\\${fileName}`;
        const destExists = previewOccupied.has(originalDest.toLowerCase());
        if (destExists && request.conflictPolicy === "skip") {
          results.push({
            status: "skipped",
            entryKey: item.entryKey,
            sourcePath: item.sourcePath,
            reason: "conflict",
          });
          skipped += 1;
        } else {
          const destinationPath = keepBothPath(
            request.destinationDirectory,
            fileName,
          );
          previewOccupied.add(destinationPath.toLowerCase());
          results.push({
            status: "moved",
            entryKey: item.entryKey,
            sourcePath: item.sourcePath,
            destinationPath,
          });
          succeeded += 1;
        }
      }
      onProgress?.({
        operationId: request.operationId,
        completed: index + 1,
        total: request.items.length,
        succeeded,
        skipped,
        failed,
      });
    }
    return results;
  },
  cancelMoveFiles: async () => {},
};
