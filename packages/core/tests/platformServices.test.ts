import { describe, expect, test } from "bun:test";
import { createDefaultSettings } from "../src/persistence/settingsSchema";
import {
  assertBatchMovePlatformContract,
  shouldShowMultiselectEntry,
  shouldShowSelectionChrome,
} from "../src/lib/selectionContract";
import type { PlatformService } from "../src/types/platform";
import type { WImage } from "../src/types";

const webLikePlatform = {
  capabilities: {
    canDeleteFiles: false,
    canRevealFile: false,
    canSelectFolder: true,
    hasCustomTitlebar: false,
    canAutoUpdate: false,
    canDragDropFolders: true,
    canBrowseArchives: false,
    canBatchMoveFiles: false,
  },
  scanImages: async () => {},
  getImageUrl: (source: string) => source,
  getThumbUrl: () => "",
  pickFolders: async () => null,
  onDragDrop: () => () => {},
  loadSettings: async () => createDefaultSettings(),
  saveSettings: async () => {},
  listDirectoryTree: async () => [],
} satisfies PlatformService;

describe("platform service capabilities", () => {
  test("allows web platforms to omit desktop-only services", () => {
    expect(webLikePlatform.deleteFile).toBeUndefined();
    expect(webLikePlatform.clearThumbnails).toBeUndefined();
    expect(webLikePlatform.requestThumbnail).toBeUndefined();
    expect(webLikePlatform.loadSelectionState).toBeUndefined();
    expect(webLikePlatform.moveFiles).toBeUndefined();
    expect(() => assertBatchMovePlatformContract(webLikePlatform)).not.toThrow();
  });

  test("hides multi-select chrome when batch move is unavailable", () => {
    const selectable: WImage = {
      source: "D:/photos/a.jpg",
      relativePath: "a.jpg",
      width: 10,
      height: 10,
      selectableFile: {
        packageKey: "d:/photos",
        entryKey: "d:/photos/a.jpg",
        locator: "D:/photos/a.jpg",
        relativePath: "a.jpg",
      },
    };
    expect(shouldShowMultiselectEntry(webLikePlatform, [selectable])).toBe(
      false,
    );
    expect(shouldShowSelectionChrome(webLikePlatform, true, 3)).toBe(false);
  });
});
