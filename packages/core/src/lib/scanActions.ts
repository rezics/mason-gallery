import { getPlatform } from "@/context/PlatformContext";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";
import type { ScanParams, WImage } from "@/types";

export async function startScan(paths: string[]) {
  const { resetAndScan, setScanning, appendImages, setTotalCount } =
    useViewerStore.getState();
  const { setFolders } = useAppStore.getState();
  const { formats, sortMethod, pageSize } = useSettingsStore.getState();

  resetAndScan();
  setFolders(paths);

  const params: ScanParams = {
    paths,
    formats,
    page_size: pageSize,
    sort_method: sortMethod,
  };

  const platform = getPlatform();

  try {
    await platform.scanImages(
      params,
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
    startScan(folders);
  }
}

export async function incrementalRefresh() {
  const { folders } = useAppStore.getState();
  if (folders.length === 0) return;

  const { relayout, getCurrentPaths, mergeImages, setScanning } =
    useViewerStore.getState();
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

        setScanning(false);
      },
      () => {},
    );
  } catch (e) {
    console.error("Incremental refresh failed:", e);
    setScanning(false);
  }
}

export function resetToDropZone() {
  useViewerStore.getState().reset();
  useAppStore.getState().setFolders([]);
}
