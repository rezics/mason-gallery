import { beforeEach, describe, expect, test } from "bun:test";
import { setPlatform } from "../src/context/PlatformContext";
import { useLibraryStore } from "../src/stores/libraryStore";
import { useSettingsStore } from "../src/stores/settingsStore";
import type {
  LibrarySource,
  LibrarySourceInput,
  LibrarySourcePatch,
  PlatformService,
} from "../src/types/platform";

function source(
  id: number,
  input: LibrarySourceInput,
  isFavorite = false,
): LibrarySource {
  return {
    id,
    kind: input.kind,
    path: input.path,
    label: input.label ?? input.path,
    isFavorite,
    addedAt: "2026-08-30T09:00:00Z",
    lastOpenedAt: input.lastOpenedAt ?? null,
    lastScannedAt: null,
    imageCount: null,
    accessStatus: "ready",
  };
}

beforeEach(() => {
  useLibraryStore.setState({
    sources: [],
    isLoading: false,
    error: null,
    _hydrated: false,
  });
  useSettingsStore.setState({
    recentSources: [],
    favoriteSources: [],
  });
});

describe("gallery library store", () => {
  test("migrates legacy shortcuts and preserves favorites", async () => {
    let sources: LibrarySource[] = [];
    const platform = {
      listLibrarySources: async () => sources,
      addLibrarySources: async (inputs: LibrarySourceInput[]) => {
        sources = inputs.map((input, index) => source(index + 1, input));
        return sources;
      },
      updateLibrarySource: async (id: number, patch: LibrarySourcePatch) => {
        sources = sources.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        );
        return sources;
      },
    } as unknown as PlatformService;
    setPlatform(platform);
    useSettingsStore.setState({
      recentSources: [
        {
          kind: "folder",
          path: "D:/photos",
          label: "Photos",
          lastOpenedAt: "2026-08-30T10:00:00Z",
        },
      ],
      favoriteSources: [
        {
          kind: "folder",
          path: "D:/photos",
          label: "Photos",
          lastOpenedAt: "2026-08-30T10:00:00Z",
        },
      ],
    });

    await useLibraryStore.getState().hydrate();

    expect(useLibraryStore.getState().sources).toHaveLength(1);
    expect(useLibraryStore.getState().sources[0]?.isFavorite).toBe(true);
    expect(useLibraryStore.getState()._hydrated).toBe(true);
  });
});
