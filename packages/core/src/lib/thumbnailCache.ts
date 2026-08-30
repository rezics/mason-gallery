import { useSyncExternalStore } from "react";
import type { Thumbnail, WImage } from "@/types";

const thumbnailsByEntry = new Map<string, Thumbnail[]>();
const listenersByEntry = new Map<string, Set<() => void>>();

export function thumbnailKey(sourceId: number, entryPath: string): string {
  return `${sourceId}:${entryPath}`;
}

function notify(key: string): void {
  for (const listener of listenersByEntry.get(key) ?? []) listener();
}

export function setCachedThumbnails(
  sourceId: number,
  entryPath: string,
  thumbnails: Thumbnail[],
): void {
  const key = thumbnailKey(sourceId, entryPath);
  thumbnailsByEntry.set(key, thumbnails);
  notify(key);
}

export function deleteCachedThumbnails(
  sourceId: number | undefined,
  entryPath: string,
): void {
  if (sourceId === undefined) return;
  const key = thumbnailKey(sourceId, entryPath);
  if (thumbnailsByEntry.delete(key)) notify(key);
}

export function clearThumbnailCache(): void {
  if (thumbnailsByEntry.size === 0) return;
  thumbnailsByEntry.clear();
  for (const key of listenersByEntry.keys()) notify(key);
}

/** Subscribe only the visible tile whose thumbnail changed. */
export function useEntryThumbnails(entry: WImage): Thumbnail[] | undefined {
  const sourceId = entry.sourceId;
  const key =
    sourceId === undefined
      ? undefined
      : thumbnailKey(sourceId, entry.relativePath);
  const fallback = entry.thumbnails;

  return useSyncExternalStore(
    (listener) => {
      if (!key) return () => undefined;
      const listeners = listenersByEntry.get(key) ?? new Set<() => void>();
      listeners.add(listener);
      listenersByEntry.set(key, listeners);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) listenersByEntry.delete(key);
      };
    },
    () => (key ? (thumbnailsByEntry.get(key) ?? fallback) : fallback),
    () => fallback,
  );
}
