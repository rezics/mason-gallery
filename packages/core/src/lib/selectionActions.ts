import { isArchiveFileName } from "@/lib/archiveFormats";
import {
  computeBatchFolderCounts,
  incrementalRefresh,
} from "@/lib/scanActions";
import {
  fileNameFromPath,
  isSelectableImage,
  normalizePathKey,
  relativePathUnderRoot,
} from "@/lib/selectionIdentity";
import { deleteCachedThumbnails } from "@/lib/thumbnailCache";
import { useAppStore } from "@/stores/appStore";
import { useLibraryStore } from "@/stores/libraryStore";
import { useSelectionStore } from "@/stores/selectionStore";
import { useViewerStore } from "@/stores/viewerStore";
import type { SelectableFileIdentity, WImage } from "@/types";
import type {
  MoveItemResult,
  PersistedSelectionEntry,
  SelectableFileProbe,
} from "@/types/platform";

export function currentPackageKeys(): string[] {
  return useAppStore
    .getState()
    .folders.filter((folder) => !isArchiveFileName(folder))
    .map((folder) => normalizePathKey(folder));
}

export function knownPackageRoots(): Array<{
  path: string;
  packageKey: string;
}> {
  const folders = useAppStore.getState().folders;
  const libraryFolders = useLibraryStore
    .getState()
    .sources.filter((source) => source.kind === "folder")
    .map((source) => source.path);
  const paths = [...folders, ...libraryFolders];
  const roots: Array<{ path: string; packageKey: string }> = [];
  const seen = new Set<string>();
  for (const path of paths) {
    const packageKey = normalizePathKey(path);
    if (seen.has(packageKey)) continue;
    seen.add(packageKey);
    roots.push({ path, packageKey });
  }
  return roots;
}

export function selectedEntries(): PersistedSelectionEntry[] {
  return [...useSelectionStore.getState().entries.values()];
}

export function visibleSelectableIdentities(
  images: WImage[],
): SelectableFileIdentity[] {
  return images.filter(isSelectableImage).map((image) => image.selectableFile);
}

export function availableSelectedEntries(
  entries: PersistedSelectionEntry[],
  probes: SelectableFileProbe[],
): PersistedSelectionEntry[] {
  const available = new Set(
    probes.filter((probe) => probe.available).map((probe) => probe.locator),
  );
  return entries.filter((entry) => available.has(entry.locator));
}

export function isUnderKnownRoot(
  filePath: string,
  roots: Array<{ path: string }>,
): boolean {
  return roots.some(
    (root) => relativePathUnderRoot(filePath, root.path) != null,
  );
}

export function coordinateGridAfterMove(results: MoveItemResult[]): void {
  const moved = results.filter((result) => result.status === "moved");
  if (moved.length === 0) return;

  const movedPaths = new Set(moved.map((result) => result.sourcePath));
  const viewer = useViewerStore.getState();
  const current = viewer.images[viewer.currentIndex];
  if (current && movedPaths.has(current.source) && viewer.isViewerOpen) {
    viewer.closeViewer();
  }

  for (const image of viewer.images) {
    if (movedPaths.has(image.source)) {
      deleteCachedThumbnails(image.sourceId, image.relativePath);
    }
  }

  viewer.mergeImages([], movedPaths);
  const remaining = useViewerStore.getState().images;
  useViewerStore.setState({ totalCount: remaining.length });

  const folders = useAppStore.getState().folders.map((path) => ({ path }));
  const destInCurrentGallery = moved.some((result) =>
    isUnderKnownRoot(result.destinationPath, folders),
  );

  if (destInCurrentGallery) {
    void incrementalRefresh();
    return;
  }

  useAppStore.setState({
    folderImageCounts: computeBatchFolderCounts(remaining),
  });
}

export function applySuccessfulMoveToSelection(
  results: MoveItemResult[],
): void {
  useSelectionStore.getState().applyMoveResults(results, knownPackageRoots());
}

export function entryDisplayName(entry: {
  relativePath: string;
  locator: string;
}): string {
  return (
    fileNameFromPath(entry.relativePath) || fileNameFromPath(entry.locator)
  );
}
