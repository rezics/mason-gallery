import { useEffect, useRef } from "react";
import { usePlatform } from "@/context/PlatformContext";
import { useViewerStore } from "@/stores/viewerStore";
import type { WImage } from "@/types";

const DWELL_MS = 150;

/**
 * Attach to a grid tile to request thumbnail generation once the tile has been
 * continuously visible for 150ms. Cancels in-flight requests when the tile
 * exits the viewport.
 *
 * `enabled` gates the whole thing (callers pass false when the entry already
 * has thumbnails, is marked skipped, or when the setting is off).
 */
export function useThumbnailRequest(
  entry: WImage,
  enabled: boolean,
): React.RefCallback<HTMLElement> {
  const platform = usePlatform();

  const elementRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const dwellTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRequestedRef = useRef(false);

  const sourceId = entry.sourceId;
  const entryPath = entry.relativePath;

  useEffect(() => {
    if (
      !enabled ||
      sourceId === undefined ||
      !platform.requestThumbnail ||
      !platform.cancelThumbnail
    ) {
      return;
    }
    const el = elementRef.current;
    if (!el) return;

    const requestThumbnail = platform.requestThumbnail;
    const cancelThumbnail = platform.cancelThumbnail;

    const clearDwell = () => {
      if (dwellTimeoutRef.current) {
        clearTimeout(dwellTimeoutRef.current);
        dwellTimeoutRef.current = null;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            if (dwellTimeoutRef.current || hasRequestedRef.current) continue;
            dwellTimeoutRef.current = setTimeout(() => {
              dwellTimeoutRef.current = null;
              const store = useViewerStore.getState();
              const key = `${sourceId}:${entryPath}`;
              if (
                store.skippedThumbs.has(key) ||
                store.requestedThumbs.has(key)
              ) {
                return;
              }
              store.markRequested(sourceId, entryPath);
              hasRequestedRef.current = true;
              requestThumbnail(sourceId, entryPath)
                .then((result) => {
                  if (result.skipped) {
                    useViewerStore.getState().markSkipped(sourceId, entryPath);
                    hasRequestedRef.current = false;
                  } else if (!result.enqueued) {
                    // Already cached or already queued: clear request flag so
                    // we don't hold the dedup forever.
                    useViewerStore
                      .getState()
                      .clearRequested(sourceId, entryPath);
                    hasRequestedRef.current = false;
                  }
                })
                .catch(() => {
                  useViewerStore.getState().clearRequested(sourceId, entryPath);
                  hasRequestedRef.current = false;
                });
            }, DWELL_MS);
          } else {
            clearDwell();
            if (hasRequestedRef.current) {
              hasRequestedRef.current = false;
              useViewerStore.getState().clearRequested(sourceId, entryPath);
              cancelThumbnail(sourceId, entryPath).catch(() => {});
            }
          }
        }
      },
      { threshold: 0.01 },
    );

    observer.observe(el);
    observerRef.current = observer;

    return () => {
      clearDwell();
      observer.disconnect();
      observerRef.current = null;
      if (hasRequestedRef.current) {
        hasRequestedRef.current = false;
        useViewerStore.getState().clearRequested(sourceId, entryPath);
        cancelThumbnail(sourceId, entryPath).catch(() => {});
      }
    };
  }, [enabled, sourceId, entryPath, platform]);

  return (el: HTMLElement | null) => {
    elementRef.current = el;
    if (observerRef.current && el) {
      observerRef.current.observe(el);
    }
  };
}
