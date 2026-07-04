import { describe, expect, test } from "bun:test";
import { setPlatform } from "../src/context/PlatformContext";
import { useSettingsStore } from "../src/stores/settingsStore";
import type { CachePolicy, PlatformService, Settings } from "../src/types/platform";

function createPlatform(settings: Partial<Settings> & Record<string, unknown>) {
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
    saveSettings: async () => {},
    setCachePolicy: async (policy: CachePolicy) => {
      syncedPolicies.push(policy);
    },
  } as unknown as PlatformService;

  setPlatform(platform);
  return { syncedPolicies };
}

describe("settings hydration", () => {
  test("falls back invalid theme values and folds legacy thumbnail sizes into cache policy", async () => {
    const { syncedPolicies } = createPlatform({
      theme: "dark",
      themePreset: "unknown",
      accentPreset: "orange",
      customAccent: "bad-color",
      cacheCleanupStrategy: "keep-all",
      passwordStorageMode: "plaintext",
      thumbnailSizes: [320, 640],
    });

    await useSettingsStore.getState().hydrate();
    const state = useSettingsStore.getState();

    expect(state.theme).toBe("dark");
    expect(state.themePreset).toBe("mason");
    expect(state.accentPreset).toBe("rose");
    expect(state.customAccent).toBe("#e75b73");
    expect(state.cacheCleanupStrategy).toBe("keep-all");
    expect(state.passwordStorageMode).toBe("plaintext");
    expect(state.thumbnailSizes).toEqual([320, 640]);
    expect(state.cachePolicy.thumbnailSizes).toEqual([320, 640]);
    expect(syncedPolicies.at(-1)?.thumbnailSizes).toEqual([320, 640]);
    expect(state._hydrated).toBe(true);
  });
});