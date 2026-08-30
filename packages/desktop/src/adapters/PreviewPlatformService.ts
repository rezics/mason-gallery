import {
  type CacheStats,
  createDefaultSettings,
  type LibrarySource,
  type LibrarySourceInput,
  type LibrarySourcePatch,
  type PlatformService,
  type Settings,
  type SourceOverride,
} from "@mason-gallery/core";

let settings = createDefaultSettings();
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

export const previewPlatformService: PlatformService = {
  capabilities: {
    canDeleteFiles: true,
    canRevealFile: true,
    canSelectFolder: true,
    hasCustomTitlebar: true,
    canAutoUpdate: false,
    canDragDropFolders: true,
    canBrowseArchives: true,
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
};
