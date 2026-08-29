import { beforeEach, describe, expect, test } from "bun:test";
import { setPlatform } from "../src/context/PlatformContext";
import { createDefaultSettings } from "../src/persistence/settingsSchema";
import { useSettingsStore } from "../src/stores/settingsStore";
import type {
  CachePolicy,
  PlatformService,
  Settings,
} from "../src/types/platform";

function createPlatform(settings: Settings) {
  const savedSettings: Settings[] = [];
  const syncedPolicies: CachePolicy[] = [];
  const platform = {
    capabilities: {
      canDeleteFiles: false,
      canRevealFile: false,
      canSelectFolder: false,
      hasCustomTitlebar: false,
      canAutoUpdate: false,
      canDragDropFolders: false,
      canBrowseArchives: false,
    },
    loadSettings: async () => settings,
    saveSettings: async (document: Settings) => {
      savedSettings.push(document);
    },
    setCachePolicy: async (policy: CachePolicy) => {
      syncedPolicies.push(policy);
    },
  } as unknown as PlatformService;

  setPlatform(platform);
  return { savedSettings, syncedPolicies };
}

beforeEach(() => {
  const defaults = createDefaultSettings();
  useSettingsStore.setState({
    ...defaults,
    thumbnailSizes: defaults.cachePolicy.thumbnailSizes,
    _hydrated: false,
  });
});

describe("settings persistence", () => {
  test("hydrates one validated document and derives thumbnail sizes", async () => {
    const settings: Settings = {
      ...createDefaultSettings(),
      theme: "dark",
      cacheCleanupStrategy: "keep-all",
      passwordStorageMode: "master",
      cachePolicy: {
        extracted: { mode: "unlimited" },
        thumbnails: { retain: "until-source-removed" },
        thumbnailSizes: [320, 640],
      },
    };
    const { syncedPolicies } = createPlatform(settings);

    await useSettingsStore.getState().hydrate();
    const state = useSettingsStore.getState();

    expect(state.theme).toBe("dark");
    expect(state.cacheCleanupStrategy).toBe("keep-all");
    expect(state.passwordStorageMode).toBe("master");
    expect(state.thumbnailSizes).toEqual([320, 640]);
    expect(state.cachePolicy.thumbnailSizes).toEqual([320, 640]);
    expect(syncedPolicies.at(-1)?.thumbnailSizes).toEqual([320, 640]);
    expect(state._hydrated).toBe(true);
  });

  test("persists an atomic settings document without the old duplicate field", async () => {
    const { savedSettings } = createPlatform(createDefaultSettings());

    useSettingsStore.getState().setTheme("dark");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const saved = savedSettings.at(-1);
    expect(saved?.theme).toBe("dark");
    expect(saved?.formats.length).toBeGreaterThan(0);
    expect(saved?.cachePolicy.thumbnailSizes).toEqual([800]);
    expect((saved as unknown as Record<string, unknown>).thumbnailSizes).toBe(
      undefined,
    );
  });
});
