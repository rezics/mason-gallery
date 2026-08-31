import type { SelectableFileIdentity, WImage } from "@/types";
import type { MoveItemResult, PersistedSelectionEntry } from "@/types/platform";

export function usesWindowsPathKeys(): boolean {
  if (
    typeof navigator !== "undefined" &&
    /windows/i.test(navigator.userAgent)
  ) {
    return true;
  }
  return false;
}

export function normalizePathKey(
  path: string,
  windows = usesWindowsPathKeys(),
): string {
  const normalized = path.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return windows ? normalized.toLowerCase() : normalized;
}

export function parentDirectory(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const slash = normalized.lastIndexOf("/");
  if (slash <= 0) return normalized;
  if (slash === 2 && /^[a-zA-Z]:\//.test(normalized)) {
    return normalized.slice(0, 3);
  }
  return normalized.slice(0, slash);
}

export function fileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const slash = normalized.lastIndexOf("/");
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

export function isSelectableImage(
  image: WImage,
): image is WImage & { selectableFile: SelectableFileIdentity } {
  return image.selectableFile != null;
}

export function toPersistedEntry(
  identity: SelectableFileIdentity,
  selectedAt = new Date().toISOString(),
  lastSeenAt: string | null = selectedAt,
): PersistedSelectionEntry {
  return {
    ...identity,
    selectedAt,
    lastSeenAt,
  };
}

export function relativePathUnderRoot(
  filePath: string,
  rootPath: string,
  windows = usesWindowsPathKeys(),
): string | null {
  const fileKey = normalizePathKey(filePath, windows);
  const rootKey = normalizePathKey(rootPath, windows);
  if (fileKey === rootKey) return fileNameFromPath(filePath);
  if (!fileKey.startsWith(`${rootKey}/`)) return null;

  const original = filePath.replace(/\\/g, "/");
  const suffixFromKey = fileKey.slice(rootKey.length + 1);
  const originalLower = windows ? original.toLowerCase() : original;
  const rootOriginal = rootPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const rootOriginalKey = windows ? rootOriginal.toLowerCase() : rootOriginal;
  if (
    originalLower.startsWith(rootOriginalKey) &&
    original.length > rootOriginal.length
  ) {
    return (
      original.slice(rootOriginal.length).replace(/^[\\/]/, "") || suffixFromKey
    );
  }
  return suffixFromKey;
}

export interface KnownPackageRoot {
  path: string;
  packageKey: string;
}

export function identityAfterMove(
  destinationPath: string,
  knownRoots: KnownPackageRoot[],
  windows = usesWindowsPathKeys(),
): SelectableFileIdentity {
  const entryKey = normalizePathKey(destinationPath, windows);
  const matching = knownRoots
    .map((root) => ({
      ...root,
      packageKey: normalizePathKey(root.path, windows),
    }))
    .filter((root) => {
      const relative = relativePathUnderRoot(
        destinationPath,
        root.path,
        windows,
      );
      return relative != null;
    })
    .sort((a, b) => b.packageKey.length - a.packageKey.length)[0];

  if (matching) {
    return {
      packageKey: matching.packageKey,
      entryKey,
      locator: destinationPath,
      relativePath:
        relativePathUnderRoot(destinationPath, matching.path, windows) ??
        fileNameFromPath(destinationPath),
    };
  }

  return {
    packageKey: normalizePathKey(parentDirectory(destinationPath), windows),
    entryKey,
    locator: destinationPath,
    relativePath: fileNameFromPath(destinationPath),
  };
}

export function selectableIdentitiesInRange(
  images: WImage[],
  fromIndex: number,
  toIndex: number,
): SelectableFileIdentity[] {
  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);
  const identities: SelectableFileIdentity[] = [];
  for (let index = start; index <= end; index += 1) {
    const image = images[index];
    if (image?.selectableFile) identities.push(image.selectableFile);
  }
  return identities;
}

export function movedResults(
  results: MoveItemResult[],
): Array<Extract<MoveItemResult, { status: "moved" }>> {
  return results.filter(
    (result): result is Extract<MoveItemResult, { status: "moved" }> =>
      result.status === "moved",
  );
}
