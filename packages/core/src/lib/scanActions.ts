import { getPlatform } from "@/context/PlatformContext";
import { useAppStore } from "@/stores/appStore";
import { useLibraryStore } from "@/stores/libraryStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";
import type { ScanParams, WImage } from "@/types";

let activeScanOperation = 0;

function beginScanOperation(): number {
  activeScanOperation += 1;
  return activeScanOperation;
}

function isActiveScan(operation: number): boolean {
  return operation === activeScanOperation;
}

function getSourceLabel(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/g, "");
  return normalized.split("/").pop() || path;
}

function rememberRecentSources(
  paths: string[],
  kind: "folder" | "archive",
): void {
  const addRecentSource = useSettingsStore.getState().addRecentSource;
  const lastOpenedAt = new Date().toISOString();
  for (const path of paths) {
    addRecentSource({
      kind,
      path,
      label: getSourceLabel(path),
      lastOpenedAt,
    });
  }
}

async function rememberLibrarySources(
  paths: string[],
  kind: "folder" | "archive",
): Promise<void> {
  const lastOpenedAt = new Date().toISOString();
  try {
    await useLibraryStore.getState().addSources(
      paths.map((path) => ({
        kind,
        path,
        label: getSourceLabel(path),
        lastOpenedAt,
      })),
    );
  } catch (error) {
    console.error("Failed to remember gallery sources:", error);
  }
}

function markLibrarySourcesScanned(paths: string[], imageCount?: number): void {
  const platform = getPlatform();
  if (!platform.markLibrarySourcesScanned) return;
  void platform
    .markLibrarySourcesScanned(paths, imageCount)
    .then(() => useLibraryStore.getState().refresh())
    .catch((error) =>
      console.error("Failed to update gallery scan metadata:", error),
    );
}

export async function requestArchiveUnlock(archivePath: string): Promise<void> {
  const platform = getPlatform();
  let requiresMasterPassword = false;

  try {
    requiresMasterPassword =
      (await platform.requiresMasterPassword?.(archivePath)) ?? false;
  } catch (error) {
    console.error("Failed to inspect stored archive password:", error);
  }

  useAppStore.setState({
    archivePasswordNeeded: requiresMasterPassword ? null : archivePath,
    archiveMasterPasswordNeeded: requiresMasterPassword ? archivePath : null,
  });
}

function computeBatchFolderCounts(
  images: { relativePath: string }[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const img of images) {
    const lastSlash = img.relativePath.lastIndexOf("/");
    if (lastSlash < 0) continue;
    let dir = img.relativePath.substring(0, lastSlash);
    while (dir) {
      counts[dir] = (counts[dir] ?? 0) + 1;
      const parentSlash = dir.lastIndexOf("/");
      dir = parentSlash > 0 ? dir.substring(0, parentSlash) : "";
    }
  }
  return counts;
}

export async function startScan(paths: string[], isRescan = false) {
  const operation = beginScanOperation();
  const {
    resetAndScan,
    setScanning,
    appendImages,
    setTotalCount,
    setInfoProgress,
    setThumbProgress,
  } = useViewerStore.getState();
  const appState = useAppStore.getState();
  const {
    setFolders,
    resetDirectoryState,
    setDirectoryTree,
    updateFolderCounts,
  } = appState;
  const { formats, sortMethod, pageSize, openGallerySidebarByDefault } =
    useSettingsStore.getState();

  resetAndScan();

  // Reset directory state fully on new folder selection; preserve expanded folders on re-scan
  if (isRescan) {
    // Keep expandedFolders and isSidebarOpen; reset counts and tree (will be repopulated)
    useAppStore.setState({
      directoryTree: [],
      selectedFolder: appState.selectedFolder,
      folderImageCounts: {},
    });
  } else {
    resetDirectoryState();
  }
  setFolders(paths);
  if (!isRescan) {
    rememberRecentSources(paths, "folder");
    await rememberLibrarySources(paths, "folder");
  }
  useAppStore.setState({ isSidebarOpen: openGallerySidebarByDefault });

  const params: ScanParams = {
    paths,
    formats,
    page_size: pageSize,
    sort_method: sortMethod,
    preserveExistingUrls: false,
  };

  const platform = getPlatform();
  let latestTotal: number | undefined;

  // Fetch directory tree in parallel with image scan
  platform
    .listDirectoryTree(paths)
    .then((tree) => {
      if (isActiveScan(operation)) setDirectoryTree(tree);
    })
    .catch((e) => console.error("Failed to list directory tree:", e));

  try {
    await platform.scanImages(
      params,
      (batch) => {
        if (!isActiveScan(operation)) return;
        if (batch.images.length > 0) {
          appendImages(batch.images);
          const counts = computeBatchFolderCounts(batch.images);
          if (Object.keys(counts).length > 0) {
            updateFolderCounts(counts);
          }
        }
      },
      () => {
        if (isActiveScan(operation)) {
          setScanning(false);
          markLibrarySourcesScanned(
            paths,
            paths.length === 1 ? latestTotal : undefined,
          );
        }
      },
      (total) => {
        if (isActiveScan(operation)) {
          latestTotal = total;
          setTotalCount(total);
        }
      },
      (progress) => {
        if (isActiveScan(operation)) setInfoProgress(progress);
      },
      (progress) => {
        if (isActiveScan(operation)) setThumbProgress(progress);
      },
    );
  } catch (e) {
    console.error("Scan failed:", e);
    if (isActiveScan(operation)) setScanning(false);
  }
}

export async function openFolderAndScan() {
  const platform = getPlatform();
  const paths = await platform.pickFolders();
  if (paths && paths.length > 0) {
    await startScan(paths);
  }
}

export function refresh() {
  const { folders } = useAppStore.getState();
  if (folders.length > 0) {
    startScan(folders, true);
  }
}

export async function incrementalRefresh() {
  const { folders } = useAppStore.getState();
  const viewerState = useViewerStore.getState();
  if (folders.length === 0 || viewerState.isScanning) return;

  const { relayout, getCurrentPaths, mergeImages, setScanning } = viewerState;
  const { setDirectoryTree } = useAppStore.getState();
  const { formats, sortMethod, pageSize } = useSettingsStore.getState();
  const operation = beginScanOperation();

  // Phase 1: Instant re-layout (re-sort existing images, preserve scroll)
  relayout();

  // Capture scanId to detect stale results
  const startScanId = useViewerStore.getState().scanId;

  // Phase 2: Background incremental scan
  const currentPaths = getCurrentPaths();
  const scannedImages: WImage[] = [];

  const params: ScanParams = {
    paths: folders,
    formats,
    page_size: pageSize,
    sort_method: sortMethod,
    preserveExistingUrls: true,
  };

  const platform = getPlatform();

  // Refresh directory tree in parallel with the scan
  platform
    .listDirectoryTree(folders)
    .then((tree) => {
      if (isActiveScan(operation)) setDirectoryTree(tree);
    })
    .catch((e) => console.error("Failed to list directory tree:", e));

  try {
    setScanning(true);
    await platform.scanImages(
      params,
      (batch) => {
        if (isActiveScan(operation)) scannedImages.push(...batch.images);
      },
      () => {
        // Stale scan guard: discard if scanId changed
        if (
          !isActiveScan(operation) ||
          useViewerStore.getState().scanId !== startScanId
        ) {
          return;
        }

        // Diff: compute added and removed
        const scannedPaths = new Set(scannedImages.map((img) => img.source));
        const added = scannedImages.filter(
          (img) => !currentPaths.has(img.source),
        );
        const removedPaths = new Set<string>();
        for (const path of currentPaths) {
          if (!scannedPaths.has(path)) {
            removedPaths.add(path);
          }
        }

        // Only merge and re-layout if there are changes
        if (added.length > 0 || removedPaths.size > 0) {
          mergeImages(added, removedPaths);
          relayout();
        }

        // Recalculate folder counts from the final image set
        const finalImages = useViewerStore.getState().images;
        const freshCounts = computeBatchFolderCounts(finalImages);
        useAppStore.setState({ folderImageCounts: freshCounts });

        setScanning(false);
      },
      () => {},
    );
  } catch (e) {
    console.error("Incremental refresh failed:", e);
    if (isActiveScan(operation)) setScanning(false);
  }
}

export async function startArchiveScan(archivePath: string, password?: string) {
  beginScanOperation();
  const { resetAndScan, setScanning } = useViewerStore.getState();
  const { setFolders, resetDirectoryState } = useAppStore.getState();

  resetAndScan();
  resetDirectoryState();
  setFolders([archivePath]);
  rememberRecentSources([archivePath], "archive");
  await rememberLibrarySources([archivePath], "archive");
  useAppStore.setState({ archivePath, isSidebarOpen: false });

  const platform = getPlatform();
  if (!platform.scanArchive) {
    console.error("Archive scanning not supported on this platform");
    setScanning(false);
    return;
  }

  // Check for migration candidate before scanning
  if (platform.checkMigration) {
    try {
      const candidate = await platform.checkMigration(archivePath);
      if (candidate) {
        useAppStore.setState({
          archiveMigrationCandidate: {
            archiveId: candidate.sourceId,
            oldPath: candidate.oldPath,
            newPath: archivePath,
          },
        });
        setScanning(false);
        return; // Wait for user to confirm migration or scan fresh
      }
    } catch {
      // Migration check failed, proceed normally
    }
  }

  await executeArchiveScan(archivePath, password);
}

export async function executeArchiveScan(
  archivePath: string,
  password?: string,
) {
  const operation = beginScanOperation();
  const {
    resetAndScan,
    setScanning,
    appendImages,
    setTotalCount,
    setInfoProgress,
    setThumbProgress,
  } = useViewerStore.getState();
  const { formats, sortMethod, pageSize } = useSettingsStore.getState();

  const platform = getPlatform();
  if (!platform.scanArchive) return;
  let latestTotal: number | undefined;

  // Check if solid and warn
  if (platform.getArchiveInfo) {
    try {
      const info = await platform.getArchiveInfo(archivePath);
      if (info.isSolid) {
        useAppStore.setState({
          archiveSolidWarning: archivePath,
        });
        setScanning(false);
        return; // Wait for user confirmation
      }
    } catch {
      // Info check failed, proceed anyway
    }
  }

  resetAndScan();

  try {
    await platform.scanArchive(
      {
        path: archivePath,
        formats,
        pageSize,
        sortMethod,
        password,
      },
      (batch) => {
        if (!isActiveScan(operation)) return;
        if (batch.images.length > 0) {
          appendImages(batch.images);
        }
      },
      () => {
        if (isActiveScan(operation)) {
          setScanning(false);
          markLibrarySourcesScanned([archivePath], latestTotal);
        }
      },
      (total) => {
        if (isActiveScan(operation)) {
          latestTotal = total;
          setTotalCount(total);
        }
      },
      (progress) => {
        if (isActiveScan(operation)) setInfoProgress(progress);
      },
      (progress) => {
        if (isActiveScan(operation)) setThumbProgress(progress);
      },
    );
  } catch (e) {
    const errorMsg = String(e);
    if (
      errorMsg.includes("PasswordRequired") ||
      errorMsg.includes("WrongPassword")
    ) {
      await requestArchiveUnlock(archivePath);
    } else {
      console.error("Archive scan failed:", e);
    }
    if (isActiveScan(operation)) setScanning(false);
  }
}

export function resetToDropZone() {
  beginScanOperation();
  useViewerStore.getState().reset();
  useAppStore.getState().setFolders([]);
  useAppStore.setState({ isSidebarOpen: false });
}

/**
 * Unlock an encrypted archive that is currently rendered as a locked
 * placeholder inside a folder view, then stream its entries into that
 * placeholder's position without resetting the rest of the grid.
 */
export async function expandLockedArchive(
  archivePath: string,
  password?: string,
): Promise<void> {
  const { replaceLockedArchive } = useViewerStore.getState();
  const { formats, sortMethod, pageSize } = useSettingsStore.getState();
  const platform = getPlatform();
  if (!platform.scanArchive) return;

  const collected: WImage[] = [];
  try {
    await platform.scanArchive(
      {
        path: archivePath,
        formats,
        pageSize,
        sortMethod,
        password,
      },
      (batch) => {
        if (batch.images.length > 0) {
          collected.push(...batch.images);
        }
      },
      () => {
        if (collected.length > 0) {
          replaceLockedArchive(archivePath, collected);
        }
      },
    );
  } catch (e) {
    const errorMsg = String(e);
    if (
      errorMsg.includes("PasswordRequired") ||
      errorMsg.includes("WrongPassword")
    ) {
      await requestArchiveUnlock(archivePath);
    } else {
      console.error("Archive expand failed:", e);
    }
    throw e;
  }
}
