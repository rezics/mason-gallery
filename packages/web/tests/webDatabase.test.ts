import { afterEach, describe, expect, test } from "bun:test";
import { createDefaultSettings } from "@mason-gallery/core";
import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import {
  loadDirectoryHandles,
  loadWebSettings,
  replaceDirectoryHandles,
  resetWebPersistence,
  saveWebSettings,
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

    expect((await loadWebSettings()).theme).toBe("dark");
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

    expect(await loadWebSettings()).toEqual(createDefaultSettings());
  });
});
