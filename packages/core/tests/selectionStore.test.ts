import { beforeEach, describe, expect, test } from "bun:test";
import { setPlatform } from "../src/context/PlatformContext";
import { createDefaultSettings } from "../src/persistence/settingsSchema";
import {
  flushSelectionPersist,
  resetSelectionStore,
  useSelectionStore,
} from "../src/stores/selectionStore";
import type {
  PersistedSelectionEntry,
  PlatformService,
  SelectionEntryKey,
} from "../src/types/platform";
import type { SelectableFileIdentity } from "../src/types";

function identity(entryKey: string): SelectableFileIdentity {
  return {
    packageKey: "d:/photos",
    entryKey,
    locator: `D:/photos/${entryKey}.jpg`,
    relativePath: `${entryKey}.jpg`,
  };
}

function createSelectionPlatform() {
  let modeEnabled = false;
  let entries: PersistedSelectionEntry[] = [];
  let failNext = false;
  const commits: Array<{
    modeEnabled?: boolean;
    upsert: PersistedSelectionEntry[];
    remove: SelectionEntryKey[];
  }> = [];

  const platform = {
    capabilities: {
      canDeleteFiles: false,
      canRevealFile: false,
      canSelectFolder: false,
      hasCustomTitlebar: false,
      canAutoUpdate: false,
      canDragDropFolders: false,
      canBrowseArchives: false,
      canBatchMoveFiles: true,
    },
    loadSettings: async () => createDefaultSettings(),
    saveSettings: async () => {},
    scanImages: async () => {},
    getImageUrl: (source: string) => source,
    getThumbUrl: () => "",
    pickFolders: async () => null,
    onDragDrop: () => () => {},
    listDirectoryTree: async () => [],
    loadSelectionState: async () => ({
      modeEnabled,
      entries: entries.map((entry) => ({ ...entry })),
    }),
    saveSelectionMode: async (enabled: boolean) => {
      modeEnabled = enabled;
    },
    upsertSelectionEntries: async () => {},
    removeSelectionEntries: async () => {},
    clearSelectionPackage: async () => {},
    clearAllSelections: async () => {
      entries = [];
    },
    replaceSelectionEntries: async () => {},
    commitSelectionMutation: async (mutation: {
      modeEnabled?: boolean;
      upsert: PersistedSelectionEntry[];
      remove: SelectionEntryKey[];
    }) => {
      if (failNext) {
        failNext = false;
        throw new Error("disk full");
      }
      commits.push(mutation);
      if (mutation.modeEnabled !== undefined) modeEnabled = mutation.modeEnabled;
      const drop = new Set(
        mutation.remove.map((key) => `${key.packageKey}:${key.entryKey}`),
      );
      entries = entries.filter(
        (entry) => !drop.has(`${entry.packageKey}:${entry.entryKey}`),
      );
      for (const entry of mutation.upsert) {
        entries = entries.filter((item) => item.entryKey !== entry.entryKey);
        entries.push(entry);
      }
    },
    probeSelectableFiles: async () => [],
    pickMoveDestination: async () => null,
    moveFiles: async () => [],
    cancelMoveFiles: async () => {},
  } satisfies PlatformService;

  setPlatform(platform);
  return {
    commits,
    failNextWrite() {
      failNext = true;
    },
    stored() {
      return { modeEnabled, entries: [...entries] };
    },
  };
}

beforeEach(() => {
  resetSelectionStore();
});

describe("selection store", () => {
  test("rejects writes until hydration succeeds", async () => {
    createSelectionPlatform();
    useSelectionStore.getState().toggle(identity("a"));
    expect(useSelectionStore.getState().entries.size).toBe(0);

    await useSelectionStore.getState().hydrate();
    expect(useSelectionStore.getState().status).toBe("ready");
    useSelectionStore.getState().toggle(identity("a"));
    expect(useSelectionStore.getState().entries.has("a")).toBe(true);
  });

  test("does not clear entries when leaving multi-select mode", async () => {
    createSelectionPlatform();
    await useSelectionStore.getState().hydrate();
    useSelectionStore.getState().toggle(identity("a"));
    useSelectionStore.getState().setModeEnabled(true);
    useSelectionStore.getState().setModeEnabled(false);
    expect(useSelectionStore.getState().modeEnabled).toBe(false);
    expect(useSelectionStore.getState().entries.has("a")).toBe(true);
  });

  test("selectMany unions identities and clearPackage is scoped", async () => {
    createSelectionPlatform();
    await useSelectionStore.getState().hydrate();
    useSelectionStore.getState().selectMany([identity("a"), identity("b")]);
    useSelectionStore.getState().selectMany([
      {
        packageKey: "e:/other",
        entryKey: "c",
        locator: "E:/other/c.jpg",
        relativePath: "c.jpg",
      },
    ]);
    useSelectionStore.getState().clearPackage("d:/photos");
    expect([...useSelectionStore.getState().entries.keys()]).toEqual(["c"]);
    useSelectionStore.getState().clearAll();
    expect(useSelectionStore.getState().entries.size).toBe(0);
  });

  test("removeByEntryKeys drops only the requested identities", async () => {
    createSelectionPlatform();
    await useSelectionStore.getState().hydrate();
    useSelectionStore.getState().selectMany([identity("a"), identity("b")]);
    useSelectionStore.getState().removeByEntryKeys(["a", "missing"]);
    expect([...useSelectionStore.getState().entries.keys()]).toEqual(["b"]);
  });

  test("rapid toggles persist the final intent", async () => {
    const { stored } = createSelectionPlatform();
    await useSelectionStore.getState().hydrate();
    useSelectionStore.getState().toggle(identity("a"));
    useSelectionStore.getState().toggle(identity("a"));
    await flushSelectionPersist();
    expect(useSelectionStore.getState().entries.has("a")).toBe(false);
    expect(stored().entries).toEqual([]);
  });

  test("rolls back an optimistic change when persistence fails", async () => {
    const harness = createSelectionPlatform();
    await useSelectionStore.getState().hydrate();
    harness.failNextWrite();
    useSelectionStore.getState().toggle(identity("a"));
    await flushSelectionPersist();
    expect(useSelectionStore.getState().entries.size).toBe(0);
    expect(useSelectionStore.getState().persistError).toContain("disk full");
  });

  test("applyMoveResults replaces identity and keeps the item selected", async () => {
    createSelectionPlatform();
    await useSelectionStore.getState().hydrate();
    useSelectionStore.getState().toggle(identity("a"));
    useSelectionStore.getState().applyMoveResults(
      [
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
      ],
      [{ path: "D:/photos", packageKey: "d:/photos" }],
    );
    const entries = [...useSelectionStore.getState().entries.values()];
    expect(entries).toHaveLength(1);
    expect(entries[0]?.locator.replace(/\\/g, "/")).toMatch(/sorted\/a\.jpg$/i);
    expect(entries[0]?.entryKey).not.toBe("a");
  });
});
