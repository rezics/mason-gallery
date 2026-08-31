import { afterEach, describe, expect, test } from "bun:test";
import {
  classifyWebDropItems,
  collectFileSystemHandlePromises,
  getSessionDirectoryHandles,
  registerSessionDirectoryHandles,
  resetSessionDirectoryHandles,
  WEB_SESSION_SCHEME,
} from "../src/adapters/webDrop";

afterEach(() => {
  resetSessionDirectoryHandles();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("web drop handle collection", () => {
  test("starts every getAsFileSystemHandle call before awaiting any of them", async () => {
    const started: number[] = [];
    const first = deferred<FileSystemHandle | null>();
    const second = deferred<FileSystemHandle | null>();
    const items = [
      {
        getAsFileSystemHandle: () => {
          started.push(1);
          return first.promise;
        },
      },
      {
        getAsFileSystemHandle: () => {
          started.push(2);
          return second.promise;
        },
      },
    ];

    const promises = collectFileSystemHandlePromises(items);
    expect(started).toEqual([1, 2]);

    first.resolve(null);
    second.resolve(null);
    await Promise.all(promises);
  });

  test("session handles are in-memory and disappear after reset", async () => {
    const handle = {
      kind: "directory",
      name: "session-photos",
    } as FileSystemDirectoryHandle;

    const registered = await registerSessionDirectoryHandles([handle]);
    expect(registered[0]?.sourcePath.startsWith(WEB_SESSION_SCHEME)).toBe(true);
    expect(getSessionDirectoryHandles()).toHaveLength(1);

    resetSessionDirectoryHandles();
    expect(getSessionDirectoryHandles()).toHaveLength(0);
  });

  test("rejects archives as unsupported on web and keeps folders", async () => {
    const folder = {
      kind: "directory",
      name: "photos",
    } as FileSystemDirectoryHandle;
    const archive = {
      kind: "file",
      name: "pack.zip",
    } as FileSystemFileHandle;
    const image = {
      kind: "file",
      name: "shot.jpg",
    } as FileSystemFileHandle;

    const items = [
      {
        getAsFileSystemHandle: async () => folder,
        getAsFile: () => ({ name: "photos" }) as File,
      },
      {
        getAsFileSystemHandle: async () => archive,
        getAsFile: () => ({ name: "pack.zip" }) as File,
      },
      {
        getAsFileSystemHandle: async () => image,
        getAsFile: () => ({ name: "shot.jpg" }) as File,
      },
    ] as unknown as DataTransferItem[];

    const batch = await classifyWebDropItems(items, async (handles) =>
      handles.map((item) => ({
        sourcePath: `web-folder://${item.name}`,
        name: item.name,
      })),
    );

    expect(batch.accepted).toEqual([
      { kind: "folder", locator: "web-folder://photos", label: "photos" },
    ]);
    expect(batch.rejected).toEqual([
      { label: "pack.zip", reason: "unsupported-platform" },
      { label: "shot.jpg", reason: "unsupported-type" },
    ]);
  });
});
