import {
  createDefaultSettings,
  createSettingsEnvelope,
  type LibrarySourceInput,
  type LibrarySourcePatch,
  migrateSettingsEnvelope,
  type Settings,
  type SettingsEnvelope,
} from "@mason-gallery/core";
import Dexie, { type Table } from "dexie";

const DATABASE_NAME = "mason-gallery-web";
const LEGACY_SETTINGS_KEY = "mason-gallery-settings";

interface SettingsRow {
  id: "current";
  envelope: SettingsEnvelope;
}

export interface DirectoryHandleRow {
  position: number;
  sourcePath: string;
  name: string;
  handle: FileSystemDirectoryHandle;
}

export interface StoredLibrarySource {
  id?: number;
  kind: "folder" | "archive";
  path: string;
  pathKey: string;
  label: string;
  isFavorite: boolean;
  addedAt: string;
  lastOpenedAt: string | null;
  lastScannedAt: string | null;
  imageCount: number | null;
}

class MasonGalleryWebDatabase extends Dexie {
  settings!: Table<SettingsRow, SettingsRow["id"]>;
  directoryHandles!: Table<DirectoryHandleRow, DirectoryHandleRow["position"]>;
  librarySources!: Table<StoredLibrarySource, number>;

  constructor() {
    super(DATABASE_NAME);
    this.version(1).stores({
      settings: "id",
      directoryHandles: "position",
    });
    this.version(2)
      .stores({
        settings: "id",
        directoryHandles: "position, &sourcePath",
        librarySources:
          "++id, &[kind+pathKey], addedAt, lastOpenedAt, isFavorite",
      })
      .upgrade((transaction) =>
        transaction
          .table<DirectoryHandleRow, number>("directoryHandles")
          .toCollection()
          .modify((row) => {
            row.sourcePath ||= `web-folder://legacy-${row.position}/${encodeURIComponent(row.name)}`;
          }),
      );
  }
}

let database: MasonGalleryWebDatabase | null = null;
let legacyStorageRemoved = false;

function removeLegacyStorage(): void {
  if (legacyStorageRemoved) return;
  legacyStorageRemoved = true;

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(LEGACY_SETTINGS_KEY);
    }
  } catch {
    // Best-effort cleanup. IndexedDB remains the only active persistence path.
  }
}

function getDatabase(): MasonGalleryWebDatabase {
  removeLegacyStorage();
  database ??= new MasonGalleryWebDatabase();
  return database;
}

export async function resetWebPersistence(): Promise<void> {
  database?.close();
  database = null;
  await Dexie.delete(DATABASE_NAME);
}

async function withDisposableRecovery<T>(
  operation: (db: MasonGalleryWebDatabase) => Promise<T>,
): Promise<T> {
  try {
    return await operation(getDatabase());
  } catch (firstError) {
    await resetWebPersistence();
    try {
      return await operation(getDatabase());
    } catch (secondError) {
      throw new AggregateError(
        [firstError, secondError],
        "Browser persistence could not be rebuilt",
      );
    }
  }
}

export async function loadWebSettings(): Promise<Settings> {
  let row: SettingsRow | undefined;
  try {
    row = await withDisposableRecovery((db) => db.settings.get("current"));
  } catch {
    return createDefaultSettings();
  }

  if (!row) return createDefaultSettings();

  try {
    return migrateSettingsEnvelope(row.envelope).settings;
  } catch {
    await resetWebPersistence();
    return createDefaultSettings();
  }
}

export async function saveWebSettings(settings: Settings): Promise<void> {
  const row: SettingsRow = {
    id: "current",
    envelope: createSettingsEnvelope(settings),
  };
  await withDisposableRecovery((db) => db.settings.put(row));
}

export async function loadDirectoryHandles(): Promise<
  FileSystemDirectoryHandle[]
> {
  const rows = await loadDirectoryHandleRows();
  return rows.map((row) => row.handle);
}

export async function loadDirectoryHandleRows(): Promise<DirectoryHandleRow[]> {
  return withDisposableRecovery((db) =>
    db.directoryHandles.orderBy("position").toArray(),
  );
}

export async function replaceDirectoryHandles(
  handles: FileSystemDirectoryHandle[],
): Promise<void> {
  await replaceDirectoryHandleRows(
    handles.map((handle, position) => ({
      position,
      sourcePath: `web-folder://${crypto.randomUUID()}`,
      name: handle.name,
      handle,
    })),
  );
}

export async function replaceDirectoryHandleRows(
  rows: DirectoryHandleRow[],
): Promise<void> {
  await withDisposableRecovery((db) =>
    db.transaction("rw", db.directoryHandles, async () => {
      await db.directoryHandles.clear();
      await db.directoryHandles.bulkPut(rows);
    }),
  );
}

async function isSameDirectory(
  left: FileSystemDirectoryHandle,
  right: FileSystemDirectoryHandle,
): Promise<boolean> {
  if (left === right) return true;
  if (typeof left.isSameEntry !== "function") {
    return left.name === right.name;
  }
  try {
    return await left.isSameEntry(right);
  } catch {
    return false;
  }
}

export async function registerDirectoryHandles(
  handles: FileSystemDirectoryHandle[],
): Promise<DirectoryHandleRow[]> {
  return withDisposableRecovery(async (db) => {
    const existing = await db.directoryHandles.orderBy("position").toArray();
    const registered: DirectoryHandleRow[] = [];
    let nextPosition =
      existing.reduce((maximum, row) => Math.max(maximum, row.position), -1) +
      1;

    for (const handle of handles) {
      let match: DirectoryHandleRow | undefined;
      for (const row of existing) {
        if (await isSameDirectory(row.handle, handle)) {
          match = row;
          break;
        }
      }
      if (match) {
        registered.push(match);
        continue;
      }

      const row: DirectoryHandleRow = {
        position: nextPosition,
        sourcePath: `web-folder://${crypto.randomUUID()}`,
        name: handle.name,
        handle,
      };
      nextPosition += 1;
      await db.directoryHandles.put(row);
      existing.push(row);
      registered.push(row);
    }

    return registered;
  });
}

function normalizeLibraryPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/g, "").toLocaleLowerCase();
}

function defaultLibraryLabel(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/g, "");
  return normalized.split("/").pop() || path;
}

export async function loadStoredLibrarySources(): Promise<
  StoredLibrarySource[]
> {
  return withDisposableRecovery((db) =>
    db.librarySources.orderBy("addedAt").reverse().toArray(),
  );
}

export async function addStoredLibrarySources(
  sources: LibrarySourceInput[],
): Promise<StoredLibrarySource[]> {
  await withDisposableRecovery((db) =>
    db.transaction("rw", db.librarySources, async () => {
      for (const source of sources) {
        const path = source.path.trim();
        if (!path) continue;
        const pathKey = normalizeLibraryPath(path);
        const existing = await db.librarySources
          .where("[kind+pathKey]")
          .equals([source.kind, pathKey])
          .first();
        if (existing?.id != null) {
          await db.librarySources.update(existing.id, {
            lastOpenedAt: source.lastOpenedAt ?? existing.lastOpenedAt,
          });
          continue;
        }
        await db.librarySources.add({
          kind: source.kind,
          path,
          pathKey,
          label: source.label?.trim() || defaultLibraryLabel(path),
          isFavorite: false,
          addedAt: new Date().toISOString(),
          lastOpenedAt: source.lastOpenedAt ?? null,
          lastScannedAt: null,
          imageCount: null,
        });
      }
    }),
  );
  return loadStoredLibrarySources();
}

export async function updateStoredLibrarySource(
  id: number,
  patch: LibrarySourcePatch,
): Promise<StoredLibrarySource[]> {
  const changes: Pick<StoredLibrarySource, "label" | "isFavorite"> = {
    label: "",
    isFavorite: false,
  };
  const current = await withDisposableRecovery((db) =>
    db.librarySources.get(id),
  );
  if (!current) return loadStoredLibrarySources();
  changes.label = patch.label?.trim() || current.label;
  changes.isFavorite = patch.isFavorite ?? current.isFavorite;
  await withDisposableRecovery((db) => db.librarySources.update(id, changes));
  return loadStoredLibrarySources();
}

export async function removeStoredLibrarySources(
  ids: number[],
): Promise<StoredLibrarySource[]> {
  await withDisposableRecovery((db) => db.librarySources.bulkDelete(ids));
  return loadStoredLibrarySources();
}

export async function markStoredLibrarySourcesScanned(
  paths: string[],
  imageCount?: number,
): Promise<void> {
  const pathKeys = new Set(paths.map(normalizeLibraryPath));
  await withDisposableRecovery((db) =>
    db.transaction("rw", db.librarySources, async () => {
      const rows = await db.librarySources.toArray();
      const scannedAt = new Date().toISOString();
      await Promise.all(
        rows
          .filter((row) => pathKeys.has(row.pathKey))
          .map((row) =>
            row.id == null
              ? Promise.resolve(0)
              : db.librarySources.update(row.id, {
                  lastScannedAt: scannedAt,
                  imageCount: imageCount ?? row.imageCount,
                }),
          ),
      );
    }),
  );
}
