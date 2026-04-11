import { getPlatform } from "@/context/PlatformContext";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";
import type { ScanParams, WImage } from "@/types";

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
  const { resetAndScan, setScanning, appendImages, setTotalCount } =
    useViewerStore.getState();
  const appState = useAppStore.getState();
  const {
    setFolders,
    resetDirectoryState,
    setDirectoryTree,
    updateFolderCounts,
  } = appState;
  const { formats, sortMethod, pageSize } = useSettingsStore.getState();

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

  const params: ScanParams = {
    paths,
    formats,
    page_size: pageSize,
    sort_method: sortMethod,
  };

  const platform = getPlatform();

  // Fetch directory tree in parallel with image scan
  platform
    .listDirectoryTree(paths)
    .then((tree) => setDirectoryTree(tree))
    .catch((e) => console.error("Failed to list directory tree:", e));

  try {
    await platform.scanImages(
      params,
      (batch) => {
        if (batch.images.length > 0) {
          appendImages(batch.images);
          const counts = computeBatchFolderCounts(batch.images);
          if (Object.keys(counts).length > 0) {
            updateFolderCounts(counts);
          }
        }
      },
      () => {
        setScanning(false);
      },
      (total) => {
        setTotalCount(total);
      },
    );
  } catch (e) {
    console.error("Scan failed:", e);
    setScanning(false);
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
  if (folders.length === 0) return;

  const { relayout, getCurrentPaths, mergeImages, setScanning } =
    useViewerStore.getState();
  const { setDirectoryTree } = useAppStore.getState();
  const { formats, sortMethod, pageSize } = useSettingsStore.getState();

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
  };

  const platform = getPlatform();

  // Refresh directory tree in parallel with the scan
  platform
    .listDirectoryTree(folders)
    .then((tree) => setDirectoryTree(tree))
    .catch((e) => console.error("Failed to list directory tree:", e));

  try {
    setScanning(true);
    await platform.scanImages(
      params,
      (batch) => {
        scannedImages.push(...batch.images);
      },
      () => {
        // Stale scan guard: discard if scanId changed
        if (useViewerStore.getState().scanId !== startScanId) {
          setScanning(false);
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
    setScanning(false);
  }
}

export async function startArchiveScan(
  archivePath: string,
  password?: string,
) {
  const { resetAndScan, setScanning, appendImages, setTotalCount } =
    useViewerStore.getState();
  const { setFolders, resetDirectoryState } = useAppStore.getState();
  const { formats, sortMethod, pageSize } = useSettingsStore.getState();

  resetAndScan();
  resetDirectoryState();
  setFolders([archivePath]);
  useAppStore.setState({ archivePath });

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
            archiveId: candidate.archiveId,
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
  const { resetAndScan, setScanning, appendImages, setTotalCount } =
    useViewerStore.getState();
  const { formats, sortMethod, pageSize } = useSettingsStore.getState();

  const platform = getPlatform();
  if (!platform.scanArchive) return;

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
        if (batch.images.length > 0) {
          appendImages(batch.images);
        }
      },
      () => {
        setScanning(false);
      },
      (total) => {
        setTotalCount(total);
      },
    );
  } catch (e) {
    const errorMsg = String(e);
    if (errorMsg.includes("PasswordRequired")) {
      useAppStore.setState({ archivePasswordNeeded: archivePath });
    } else if (errorMsg.includes("WrongPassword")) {
      useAppStore.setState({ archivePasswordNeeded: archivePath });
    } else {
      console.error("Archive scan failed:", e);
    }
    setScanning(false);
  }
}

export function resetToDropZone() {
  useViewerStore.getState().reset();
  useAppStore.getState().setFolders([]);
}
