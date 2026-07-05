import { describe, expect, test } from "bun:test";
import type { PlatformService } from "../src/types/platform";

const webLikePlatform = {
  capabilities: {
    canDeleteFiles: false,
    canRevealFile: false,
    canSelectFolder: true,
    hasCustomTitlebar: false,
    canAutoUpdate: false,
    canDragDropFolders: true,
    canBrowseArchives: false,
  },
  scanImages: async () => {},
  getImageUrl: (source: string) => source,
  getThumbUrl: () => "",
  pickFolders: async () => null,
  onDragDrop: () => () => {},
  loadSettings: async () => ({}),
  saveSettings: async () => {},
  listDirectoryTree: async () => [],
} satisfies PlatformService;

describe("platform service capabilities", () => {
  test("allows web platforms to omit desktop-only services", () => {
    expect(webLikePlatform.deleteFile).toBeUndefined();
    expect(webLikePlatform.clearThumbnails).toBeUndefined();
    expect(webLikePlatform.requestThumbnail).toBeUndefined();
  });
});
