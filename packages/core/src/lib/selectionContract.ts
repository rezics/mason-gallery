import { isSelectableImage } from "@/lib/selectionIdentity";
import type { WImage } from "@/types";
import type { PlatformService } from "@/types/platform";

export const SELECTION_PLATFORM_METHODS = [
  "loadSelectionState",
  "saveSelectionMode",
  "upsertSelectionEntries",
  "removeSelectionEntries",
  "clearSelectionPackage",
  "clearAllSelections",
  "replaceSelectionEntries",
  "commitSelectionMutation",
  "probeSelectableFiles",
  "pickMoveDestination",
  "moveFiles",
  "cancelMoveFiles",
] as const satisfies ReadonlyArray<keyof PlatformService>;

export function selectionMethodsPresent(platform: PlatformService): boolean {
  return SELECTION_PLATFORM_METHODS.every(
    (method) => typeof platform[method] === "function",
  );
}

export function assertBatchMovePlatformContract(
  platform: PlatformService,
): void {
  if (platform.capabilities.canBatchMoveFiles) {
    if (!selectionMethodsPresent(platform)) {
      throw new Error(
        "canBatchMoveFiles requires every selection and batch-move method",
      );
    }
    return;
  }
  for (const method of SELECTION_PLATFORM_METHODS) {
    if (typeof platform[method] === "function") {
      throw new Error(
        `canBatchMoveFiles is false but ${method} is implemented; web/CLI must omit these methods`,
      );
    }
  }
}

export function galleryHasSelectableFiles(images: WImage[]): boolean {
  return images.some(isSelectableImage);
}

export function shouldShowMultiselectEntry(
  platform: PlatformService,
  images: WImage[],
): boolean {
  return (
    platform.capabilities.canBatchMoveFiles && galleryHasSelectableFiles(images)
  );
}

export function shouldShowSelectionChrome(
  platform: PlatformService,
  modeEnabled: boolean,
): boolean {
  return platform.capabilities.canBatchMoveFiles && modeEnabled;
}
