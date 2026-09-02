import { beforeEach, describe, expect, test } from "bun:test";
import { setPlatform } from "../src/context/PlatformContext";
import { applyLibraryEffect, startScan } from "../src/lib/scanActions";
import { createDefaultSettings } from "../src/persistence/settingsSchema";
import { useLibraryStore } from "../src/stores/libraryStore";
import { useSettingsStore } from "../src/stores/settingsStore";
import { useViewerStore } from "../src/stores/viewerStore";
import type {
  LibrarySource,
  LibrarySourceInput,
  PlatformService,
} from "../src/types/platform";

function sourceFromInput(
  id: number,
  input: LibrarySourceInput,
): LibrarySource {
  return {
    id,
    kind: input.kind,
    path: input.path,
    label: input.label ?? input.path,
    isFavorite: false,
    addedAt: "2026-08-30T09:00:00Z",
    lastOpenedAt: input.lastOpenedAt ?? null,
    lastScannedAt: null,
    imageCount: null,
    accessStatus: "ready",
  };
}

function createPlatform() {
  let nextId = 1;
  let sources: LibrarySource[] = [];
  const marked: Array<{ paths: string[]; imageCount?: number }> = [];
  const scans: string[][] = [];

  const platform = {
    capabilities: {
      canDeleteFiles: false,
      canRevealFile: false,
      canSelectFolder: true,
      hasCustomTitlebar: false,
      canAutoUpdate: false,
      canDragDropFolders: true,
      canBrowseArchives: true,
      canBatchMoveFiles: false,
      hasSystemIntegration: false,
    },
    scanImages: async (
      params: { paths: string[] },
      _onBatch: unknown,
      onComplete: () => void,
    ) => {
      scans.push(params.paths);
      onComplete();
    },
    getImageUrl: (source: string) => source,
    getThumbUrl: () => "",
    pickFolders: async () => null,
    onDragDrop: () => () => {},
    loadSettings: async () => createDefaultSettings(),
    saveSettings: async () => {},
    listDirectoryTree: async () => [],
    listLibrarySources: async () => sources,
    addLibrarySources: async (inputs: LibrarySourceInput[]) => {
      for (const input of inputs) {
        const existing = sources.find(
          (item) => item.kind === input.kind && item.path === input.path,
        );
        if (existing) {
          existing.lastOpenedAt = input.lastOpenedAt ?? existing.lastOpenedAt;
          continue;
        }
        sources = [...sources, sourceFromInput(nextId, input)];
        nextId += 1;
      }
      return sources;
    },
    markLibrarySourcesScanned: async (paths: string[], imageCount?: number) => {
      marked.push({ paths, imageCount });
    },
  } as unknown as PlatformService;

  setPlatform(platform);
  return { getSources: () => sources, marked, scans };
}

beforeEach(() => {
  const defaults = createDefaultSettings();
  useSettingsStore.setState({
    ...defaults,
    thumbnailSizes: defaults.cachePolicy.thumbnailSizes,
    recentSources: [],
    _hydrated: true,
  });
  useLibraryStore.setState({
    sources: [],
    isLoading: false,
    error: null,
    _hydrated: true,
  });
  useViewerStore.getState().reset();
});

describe("library effects", () => {
  test("ensure creates library and recent records", async () => {
    createPlatform();
    await applyLibraryEffect(
      [{ kind: "folder", locator: "D:/Photos", label: "Photos" }],
      "ensure",
    );

    expect(useLibraryStore.getState().sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "folder",
          path: "D:/Photos",
          label: "Photos",
        }),
      ]),
    );
    expect(useSettingsStore.getState().recentSources[0]).toMatchObject({
      kind: "folder",
      path: "D:/Photos",
      label: "Photos",
    });
  });

  test("none leaves library and recent empty", async () => {
    createPlatform();
    await applyLibraryEffect(
      [{ kind: "folder", locator: "D:/Photos", label: "Photos" }],
      "none",
    );

    expect(useLibraryStore.getState().sources).toEqual([]);
    expect(useSettingsStore.getState().recentSources).toEqual([]);
  });

  test("touch updates existing library items and does not create missing ones", async () => {
    const { getSources } = createPlatform();
    await useLibraryStore.getState().addSources([
      {
        kind: "folder",
        path: "D:/Known",
        label: "Known",
        lastOpenedAt: "2026-08-01T00:00:00.000Z",
      },
    ]);

    await applyLibraryEffect(
      [
        { kind: "folder", locator: "D:/Known", label: "Known" },
        { kind: "folder", locator: "D:/New", label: "New" },
      ],
      "touch",
    );

    expect(getSources().map((source) => source.path)).toEqual(["D:/Known"]);
    expect(getSources()[0]?.lastOpenedAt).not.toBe("2026-08-01T00:00:00.000Z");
    expect(
      useSettingsStore.getState().recentSources.map((item) => item.path),
    ).toEqual(["D:/Known"]);
  });

  test("open-only scans do not mark library sources", async () => {
    const { marked, scans } = createPlatform();
    await startScan(["D:/Temp"], { libraryEffect: "none" });

    expect(scans).toEqual([["D:/Temp"]]);
    expect(marked).toEqual([]);
    expect(useLibraryStore.getState().sources).toEqual([]);
    expect(useSettingsStore.getState().recentSources).toEqual([]);
  });

  test("ensure scans persist library records", async () => {
    const { marked } = createPlatform();
    await startScan(["D:/Photos"], { libraryEffect: "ensure" });

    expect(useLibraryStore.getState().sources[0]?.path).toBe("D:/Photos");
    expect(marked).toEqual([{ paths: ["D:/Photos"], imageCount: undefined }]);
  });
});
