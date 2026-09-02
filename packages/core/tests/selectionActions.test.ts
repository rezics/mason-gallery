import { beforeEach, describe, expect, test } from "bun:test";
import { setPlatform } from "../src/context/PlatformContext";
import {
  applySuccessfulDeleteToSelection,
  applySuccessfulMoveToSelection,
  coordinateGridAfterDelete,
  deleteSelectedFiles,
} from "../src/lib/selectionActions";
import { createDefaultSettings } from "../src/persistence/settingsSchema";
import { useAppStore } from "../src/stores/appStore";
import {
  resetSelectionStore,
  useSelectionStore,
} from "../src/stores/selectionStore";
import { useViewerStore } from "../src/stores/viewerStore";
import type { WImage } from "../src/types";
import type { PlatformService } from "../src/types/platform";

function createSelectionPlatform() {
  const platform = {
    capabilities: {
      canDeleteFiles: true,
      canRevealFile: false,
      canSelectFolder: false,
      hasCustomTitlebar: false,
      canAutoUpdate: false,
      canDragDropFolders: false,
      canBrowseArchives: false,
      canBatchMoveFiles: true,
      hasSystemIntegration: false,
    },
    loadSettings: async () => createDefaultSettings(),
    saveSettings: async () => {},
    scanImages: async () => {},
    getImageUrl: (source: string) => source,
    getThumbUrl: () => "",
    pickFolders: async () => null,
    onDragDrop: () => () => {},
    listDirectoryTree: async () => [],
    loadSelectionState: async () => ({ modeEnabled: false, entries: [] }),
    saveSelectionMode: async () => {},
    upsertSelectionEntries: async () => {},
    removeSelectionEntries: async () => {},
    clearSelectionPackage: async () => {},
    clearAllSelections: async () => {},
    replaceSelectionEntries: async () => {},
    commitSelectionMutation: async () => {},
    probeSelectableFiles: async () => [],
    pickMoveDestination: async () => null,
    moveFiles: async () => [],
    cancelMoveFiles: async () => {},
  } satisfies PlatformService;

  setPlatform(platform);
}

function image(source: string, relativePath: string): WImage {
  return {
    source,
    relativePath,
    width: 800,
    height: 600,
    sourceId: 1,
  };
}

beforeEach(() => {
  resetSelectionStore();
  useViewerStore.getState().reset();
  useAppStore.getState().reset();
});

describe("deleteSelectedFiles", () => {
  test("continues after a failure and reports both outcomes", async () => {
    const deleted: string[] = [];
    const result = await deleteSelectedFiles(
      [
        { entryKey: "a", locator: "D:/photos/a.jpg" },
        { entryKey: "b", locator: "D:/photos/b.jpg" },
        { entryKey: "c", locator: "D:/photos/c.jpg" },
      ],
      async (path) => {
        if (path.endsWith("b.jpg")) throw new Error("locked");
        deleted.push(path);
      },
    );

    expect(deleted).toEqual(["D:/photos/a.jpg", "D:/photos/c.jpg"]);
    expect(result.deletedKeys).toEqual(["a", "c"]);
    expect(result.deletedPaths).toEqual(["D:/photos/a.jpg", "D:/photos/c.jpg"]);
    expect(result.failed).toBe(1);
  });
});

describe("coordinateGridAfterDelete", () => {
  test("removes deleted files from the grid and closes the viewer on the current image", () => {
    useViewerStore.setState({
      images: [
        image("D:/photos/sub/keep.jpg", "sub/keep.jpg"),
        image("D:/photos/sub/gone.jpg", "sub/gone.jpg"),
      ],
      currentIndex: 1,
      isViewerOpen: true,
      totalCount: 2,
    });

    coordinateGridAfterDelete(["D:/photos/sub/gone.jpg"]);

    const viewer = useViewerStore.getState();
    expect(viewer.images.map((item) => item.source)).toEqual([
      "D:/photos/sub/keep.jpg",
    ]);
    expect(viewer.isViewerOpen).toBe(false);
    expect(viewer.totalCount).toBe(1);
    expect(useAppStore.getState().folderImageCounts).toEqual({ sub: 1 });
  });
});

describe("selection after file changes", () => {
  test("a successful move drops only relocated identities", async () => {
    createSelectionPlatform();
    await useSelectionStore.getState().hydrate();
    useSelectionStore.getState().selectMany([
      {
        packageKey: "d:/photos",
        entryKey: "a",
        locator: "D:/photos/a.jpg",
        relativePath: "a.jpg",
      },
      {
        packageKey: "d:/photos",
        entryKey: "b",
        locator: "D:/photos/b.jpg",
        relativePath: "b.jpg",
      },
    ]);
    applySuccessfulMoveToSelection([
      {
        status: "moved",
        entryKey: "a",
        sourcePath: "D:/photos/a.jpg",
        destinationPath: "D:/photos/sorted/a.jpg",
      },
      {
        status: "skipped",
        entryKey: "b",
        sourcePath: "D:/photos/b.jpg",
        reason: "conflict",
      },
    ]);
    expect([...useSelectionStore.getState().entries.keys()]).toEqual(["b"]);
  });

  test("deleting drops only the removed identities", async () => {
    createSelectionPlatform();
    await useSelectionStore.getState().hydrate();
    useSelectionStore.getState().selectMany([
      {
        packageKey: "d:/photos",
        entryKey: "a",
        locator: "D:/photos/a.jpg",
        relativePath: "a.jpg",
      },
      {
        packageKey: "d:/photos",
        entryKey: "b",
        locator: "D:/photos/b.jpg",
        relativePath: "b.jpg",
      },
    ]);
    applySuccessfulDeleteToSelection(["a"]);
    expect([...useSelectionStore.getState().entries.keys()]).toEqual(["b"]);
  });
});
