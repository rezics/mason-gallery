import {
  createDefaultSettings,
  createSettingsEnvelope,
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

interface DirectoryHandleRow {
  position: number;
  name: string;
  handle: FileSystemDirectoryHandle;
}

class MasonGalleryWebDatabase extends Dexie {
  settings!: Table<SettingsRow, SettingsRow["id"]>;
  directoryHandles!: Table<DirectoryHandleRow, DirectoryHandleRow["position"]>;

  constructor() {
    super(DATABASE_NAME);
    this.version(1).stores({
      settings: "id",
      directoryHandles: "position",
    });
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
  const rows = await withDisposableRecovery((db) =>
    db.directoryHandles.orderBy("position").toArray(),
  );
  return rows.map((row) => row.handle);
}

export async function replaceDirectoryHandles(
  handles: FileSystemDirectoryHandle[],
): Promise<void> {
  await withDisposableRecovery((db) =>
    db.transaction("rw", db.directoryHandles, async () => {
      await db.directoryHandles.clear();
      await db.directoryHandles.bulkPut(
        handles.map((handle, position) => ({
          position,
          name: handle.name,
          handle,
        })),
      );
    }),
  );
}
