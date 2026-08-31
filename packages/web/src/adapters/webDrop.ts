import {
  type DropBatch,
  type DroppedSource,
  type DropRejection,
  isArchiveFileName,
} from "@mason-gallery/core";

export const WEB_SESSION_SCHEME = "web-session://";

export interface SessionDirectoryHandle {
  sourcePath: string;
  name: string;
  handle: FileSystemDirectoryHandle;
}

const sessionHandles: SessionDirectoryHandle[] = [];

export function canUseFileSystemDrop(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof DataTransferItem !== "undefined" &&
    typeof DataTransferItem.prototype.getAsFileSystemHandle === "function"
  );
}

export function getSessionDirectoryHandles(): SessionDirectoryHandle[] {
  return [...sessionHandles];
}

export function resetSessionDirectoryHandles(): void {
  sessionHandles.length = 0;
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

export async function registerSessionDirectoryHandles(
  handles: FileSystemDirectoryHandle[],
): Promise<SessionDirectoryHandle[]> {
  const registered: SessionDirectoryHandle[] = [];
  for (const handle of handles) {
    let match = sessionHandles.find((row) => row.handle === handle);
    if (!match) {
      for (const row of sessionHandles) {
        if (await isSameDirectory(row.handle, handle)) {
          match = row;
          break;
        }
      }
    }
    if (match) {
      registered.push(match);
      continue;
    }
    const row: SessionDirectoryHandle = {
      sourcePath: `${WEB_SESSION_SCHEME}${crypto.randomUUID()}`,
      name: handle.name,
      handle,
    };
    sessionHandles.push(row);
    registered.push(row);
  }
  return registered;
}

export function collectFileSystemHandlePromises(
  items: ArrayLike<{
    getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
  }>,
): Promise<FileSystemHandle | null>[] {
  const promises: Promise<FileSystemHandle | null>[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item && typeof item.getAsFileSystemHandle === "function") {
      promises.push(item.getAsFileSystemHandle());
    } else {
      promises.push(Promise.resolve(null));
    }
  }
  return promises;
}

function rejectFile(name: string): DropRejection {
  return {
    label: name || "file",
    reason: isArchiveFileName(name)
      ? "unsupported-platform"
      : "unsupported-type",
  };
}

function hasFilePayload(dataTransfer: DataTransfer | null): boolean {
  return Boolean(dataTransfer?.types?.includes("Files"));
}

export function shouldAcceptWebDrag(
  dataTransfer: DataTransfer | null,
): boolean {
  return hasFilePayload(dataTransfer);
}

export async function classifyWebDropItems(
  items: ArrayLike<DataTransferItem>,
  persistDirectories: (
    handles: FileSystemDirectoryHandle[],
  ) => Promise<Array<{ sourcePath: string; name: string }>>,
): Promise<DropBatch> {
  const handlePromises = collectFileSystemHandlePromises(items);
  const labels: string[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    labels.push(item?.getAsFile()?.name ?? item?.kind ?? "item");
  }

  const settled = await Promise.allSettled(handlePromises);
  const directories: FileSystemDirectoryHandle[] = [];
  const rejected: DropRejection[] = [];

  settled.forEach((result, index) => {
    const label = labels[index] ?? "item";
    if (result.status === "rejected") {
      rejected.push({ label, reason: "permission-denied" });
      return;
    }
    const handle = result.value;
    if (!handle) {
      if (label && label !== "file" && label !== "item") {
        rejected.push(rejectFile(label));
      }
      return;
    }
    if (handle.kind === "directory") {
      directories.push(handle as FileSystemDirectoryHandle);
      return;
    }
    rejected.push(rejectFile(handle.name || label));
  });

  const registered = directories.length
    ? await persistDirectories(directories)
    : [];
  const accepted: DroppedSource[] = registered.map((row) => ({
    kind: "folder",
    locator: row.sourcePath,
    label: row.name,
  }));

  return { accepted, rejected };
}
