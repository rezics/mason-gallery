import { afterEach, describe, expect, test } from "bun:test";
import { createDefaultSettings } from "@mason-gallery/core";
import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import {
  addStoredLibrarySources,
  loadDirectoryHandles,
  loadStoredLibrarySources,
  loadWebSettings,
  markStoredLibrarySourcesScanned,
  registerDirectoryHandles,
  removeStoredLibrarySources,
  replaceDirectoryHandles,
  resetWebPersistence,
  saveWebSettings,
  updateStoredLibrarySource,
} from "../src/persistence/webDatabase";

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

afterEach(async () => {
  await resetWebPersistence();
});

describe("disposable browser persistence", () => {
  test("stores and restores a versioned settings document", async () => {
    const settings = {
      ...createDefaultSettings(),
      theme: "dark" as const,
    };

    await saveWebSettings(settings);

    const loaded = await loadWebSettings();
    expect(loaded.source).toBe("persisted");
    expect(loaded.settings.theme).toBe("dark");
  });

  test("distinguishes default settings from an explicit saved preference", async () => {
    const initial = await loadWebSettings();
    expect(initial.source).toBe("default");
    expect(initial.settings.language).toBe("en");

    await saveWebSettings(initial.settings);
    const saved = await loadWebSettings();
    expect(saved.source).toBe("persisted");
    expect(saved.settings.language).toBe("en");
  });

  test("stores serializable directory handles in IndexedDB order", async () => {
    const first = {
      kind: "directory",
      name: "photos",
    } as FileSystemDirectoryHandle;
    const second = {
      kind: "directory",
      name: "screenshots",
    } as FileSystemDirectoryHandle;

    await replaceDirectoryHandles([first, second]);

    expect((await loadDirectoryHandles()).map((handle) => handle.name)).toEqual(
      ["photos", "screenshots"],
    );
  });

  test("registers a directory handle once with a stable virtual path", async () => {
    const handle = {
      kind: "directory",
      name: "photos",
    } as FileSystemDirectoryHandle;

    const first = await registerDirectoryHandles([handle]);
    const second = await registerDirectoryHandles([handle]);

    expect(second[0]?.sourcePath).toBe(first[0]?.sourcePath);
    expect((await loadDirectoryHandles()).length).toBe(1);
  });

  test("persists and manages gallery sources independently", async () => {
    let sources = await addStoredLibrarySources([
      {
        kind: "folder",
        path: "web-folder://photos",
        label: "Photos",
        lastOpenedAt: "2026-08-30T10:00:00Z",
      },
    ]);
    const id = sources[0]?.id;
    expect(id).toBeNumber();

    sources = await updateStoredLibrarySource(id!, { isFavorite: true });
    await markStoredLibrarySourcesScanned(["web-folder://photos"], 42);
    sources = await loadStoredLibrarySources();
    expect(sources[0]).toMatchObject({
      label: "Photos",
      isFavorite: true,
      imageCount: 42,
    });

    await removeStoredLibrarySources([id!]);
    expect(await loadStoredLibrarySources()).toEqual([]);
  });

  test("migrates a stored v1 settings document to the current schema", async () => {
    await resetWebPersistence();
    const { autoCheckUpdates: _autoCheckUpdates, ...v1Settings } = {
      ...createDefaultSettings(),
      language: "ja" as const,
      theme: "light" as const,
    };
    const raw = new Dexie("mason-gallery-web");
    raw.version(1).stores({
      settings: "id",
      directoryHandles: "position",
    });
    await raw.table("settings").put({
      id: "current",
      envelope: { version: 1, settings: v1Settings },
    });
    raw.close();

    const loaded = await loadWebSettings();
    expect(loaded.source).toBe("persisted");
    expect(loaded.settings.autoCheckUpdates).toBe(true);
    expect(loaded.settings.externalDropBehavior).toBe("add-and-open");
    expect(loaded.settings.language).toBe("ja");
    expect(loaded.settings.theme).toBe("light");

    const roundTrip = await loadWebSettings();
    expect(roundTrip.source).toBe("persisted");
    expect(roundTrip.settings.autoCheckUpdates).toBe(true);
    expect(roundTrip.settings.language).toBe("ja");
  });

  test("rebuilds the whole database for an incompatible settings schema", async () => {
    await resetWebPersistence();
    const raw = new Dexie("mason-gallery-web");
    raw.version(1).stores({
      settings: "id",
      directoryHandles: "position",
    });
    await raw.table("settings").put({
      id: "current",
      envelope: { version: 99, settings: {} },
    });
    raw.close();

    expect(await loadWebSettings()).toEqual({
      source: "default",
      settings: createDefaultSettings(),
    });
  });
});
