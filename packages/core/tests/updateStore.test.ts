import { beforeEach, describe, expect, test } from "bun:test";
import { setPlatform } from "../src/context/PlatformContext";
import { createDefaultSettings } from "../src/persistence/settingsSchema";
import { useSettingsStore } from "../src/stores/settingsStore";
import {
  resetUpdateStore,
  setUpdateBackend,
  setUpdateProductionBuild,
  useUpdateStore,
} from "../src/stores/updateStore";
import type { PlatformService, Settings } from "../src/types/platform";

function createPlatform(canAutoUpdate: boolean) {
  const savedSettings: Settings[] = [];
  setPlatform({
    capabilities: {
      canDeleteFiles: false,
      canRevealFile: false,
      canSelectFolder: false,
      hasCustomTitlebar: false,
      canAutoUpdate,
      canDragDropFolders: false,
      canBrowseArchives: false,
      canBatchMoveFiles: false,
      hasSystemIntegration: false,
    },
    saveSettings: async (document: Settings) => {
      savedSettings.push(document);
    },
  } as unknown as PlatformService);
  return { savedSettings };
}

beforeEach(() => {
  resetUpdateStore();
  setUpdateBackend(null);
  useSettingsStore.setState({
    ...createDefaultSettings(),
    thumbnailSizes: createDefaultSettings().cachePolicy.thumbnailSizes,
    autoCheckUpdates: true,
    _hydrated: true,
  });
});

describe("update store", () => {
  test("does not auto-check when the user turned the switch off", async () => {
    let checkCalls = 0;
    setUpdateBackend({
      check: async () => {
        checkCalls += 1;
        return null;
      },
      install: async () => {},
    });
    createPlatform(true);
    setUpdateProductionBuild(true);
    useSettingsStore.setState({ autoCheckUpdates: false });

    await useUpdateStore.getState().check("auto");
    expect(checkCalls).toBe(0);
    expect(useUpdateStore.getState().status).toBe("idle");
  });

  test("development blocks auto-check but still persists the switch and allows manual checks", async () => {
    let checkCalls = 0;
    setUpdateBackend({
      check: async () => {
        checkCalls += 1;
        return null;
      },
      install: async () => {},
    });
    const { savedSettings } = createPlatform(true);
    setUpdateProductionBuild(false);

    useSettingsStore.getState().setAutoCheckUpdates(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(savedSettings.at(-1)?.autoCheckUpdates).toBe(false);

    useSettingsStore.getState().setAutoCheckUpdates(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(savedSettings.at(-1)?.autoCheckUpdates).toBe(true);

    await useUpdateStore.getState().check("auto");
    expect(checkCalls).toBe(0);
    expect(useUpdateStore.getState().status).toBe("idle");

    await useUpdateStore.getState().check("manual");
    expect(checkCalls).toBe(1);
    expect(useUpdateStore.getState().status).toBe("up-to-date");
  });

  test("production auto-check runs when the switch is on", async () => {
    let checkCalls = 0;
    setUpdateBackend({
      check: async () => {
        checkCalls += 1;
        return null;
      },
      install: async () => {},
    });
    createPlatform(true);
    setUpdateProductionBuild(true);

    await useUpdateStore.getState().check("auto");
    expect(checkCalls).toBe(1);
    expect(useUpdateStore.getState().status).toBe("up-to-date");
  });

  test("manual checks still run when auto-check is off", async () => {
    let checkCalls = 0;
    setUpdateBackend({
      check: async () => {
        checkCalls += 1;
        return null;
      },
      install: async () => {},
    });
    createPlatform(true);
    setUpdateProductionBuild(false);
    useSettingsStore.setState({ autoCheckUpdates: false });

    await useUpdateStore.getState().check("manual");
    expect(checkCalls).toBe(1);
    expect(useUpdateStore.getState().status).toBe("up-to-date");
  });

  test("desktop-like platforms can still run a manual check", async () => {
    let checkCalls = 0;
    setUpdateBackend({
      check: async () => {
        checkCalls += 1;
        return { version: "2.2.0" };
      },
      install: async () => {},
    });
    createPlatform(true);
    setUpdateProductionBuild(false);

    await useUpdateStore.getState().check("manual");
    expect(checkCalls).toBe(1);
    expect(useUpdateStore.getState().status).toBe("available");
  });

  test("hides updater work when the platform cannot auto-update", async () => {
    let checkCalls = 0;
    setUpdateBackend({
      check: async () => {
        checkCalls += 1;
        return null;
      },
      install: async () => {},
    });
    createPlatform(false);
    setUpdateProductionBuild(true);

    await useUpdateStore.getState().check("manual");
    await useUpdateStore.getState().check("auto");
    expect(checkCalls).toBe(0);
  });
});
