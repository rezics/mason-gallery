import { create } from "zustand";
import type { Thumbnail, WImage } from "@/types";

interface ViewerState {
  images: WImage[];
  currentIndex: number;
  isViewerOpen: boolean;
  isScanning: boolean;
  scanId: number;
  totalCount: number;
  isRelayout: boolean;
  /** `"<sourceId>:<entryPath>"` keys for entries below minFileSize — no
   * further requests should be issued for these. */
  skippedThumbs: Set<string>;
  /** `"<sourceId>:<entryPath>"` keys for requests currently in flight — used
   * to dedupe concurrent viewport re-entries. */
  requestedThumbs: Set<string>;

  appendImages: (newImages: WImage[]) => void;
  setCurrentIndex: (index: number) => void;
  openViewer: (index: number) => void;
  closeViewer: () => void;
  setScanning: (scanning: boolean) => void;
  setTotalCount: (count: number) => void;
  removeImage: (index: number) => void;
  resetAndScan: () => void;
  reset: () => void;
  relayout: () => void;
  mergeImages: (added: WImage[], removedPaths: Set<string>) => void;
  getCurrentPaths: () => Set<string>;
  patchThumbnails: (
    sourceId: number,
    entryPath: string,
    thumbnails: Thumbnail[],
  ) => void;
  markSkipped: (sourceId: number, entryPath: string) => void;
  markRequested: (sourceId: number, entryPath: string) => void;
  clearRequested: (sourceId: number, entryPath: string) => void;
  /** Replace a `locked: true` placeholder for `archivePath` with newly scanned
   * entries. Inserts the new entries at the placeholder's position so sort
   * order is preserved. No-op when no matching placeholder exists. */
  replaceLockedArchive: (archivePath: string, added: WImage[]) => void;
}

function thumbKey(sourceId: number, entryPath: string): string {
  return `${sourceId}:${entryPath}`;
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  images: [],
  currentIndex: 0,
  isViewerOpen: false,
  isScanning: false,
  scanId: 0,
  totalCount: 0,
  isRelayout: false,
  skippedThumbs: new Set<string>(),
  requestedThumbs: new Set<string>(),

  appendImages: (newImages) =>
    set((state) => ({ images: [...state.images, ...newImages] })),

  setCurrentIndex: (currentIndex) => set({ currentIndex }),

  openViewer: (index) => set({ isViewerOpen: true, currentIndex: index }),

  closeViewer: () => set({ isViewerOpen: false }),

  setScanning: (isScanning) => set({ isScanning }),

  setTotalCount: (totalCount) => set({ totalCount }),

  removeImage: (index) =>
    set((state) => {
      const images = state.images.filter((_, i) => i !== index);
      const currentIndex = Math.min(state.currentIndex, images.length - 1);
      return { images, currentIndex: Math.max(0, currentIndex) };
    }),

  resetAndScan: () =>
    set((state) => ({
      images: [],
      currentIndex: 0,
      isViewerOpen: false,
      isScanning: true,
      scanId: state.scanId + 1,
      totalCount: 0,
      isRelayout: false,
      skippedThumbs: new Set<string>(),
      requestedThumbs: new Set<string>(),
    })),

  reset: () =>
    set({
      images: [],
      currentIndex: 0,
      isViewerOpen: false,
      isScanning: false,
      totalCount: 0,
      skippedThumbs: new Set<string>(),
      requestedThumbs: new Set<string>(),
    }),

  relayout: () =>
    set((state) => ({
      scanId: state.scanId + 1,
      isRelayout: true,
    })),

  mergeImages: (added, removedPaths) =>
    set((state) => {
      const filtered =
        removedPaths.size > 0
          ? state.images.filter((img) => !removedPaths.has(img.source))
          : state.images;
      const images = added.length > 0 ? [...filtered, ...added] : filtered;
      const currentIndex = Math.min(
        state.currentIndex,
        Math.max(0, images.length - 1),
      );
      return { images, currentIndex };
    }),

  getCurrentPaths: () => {
    const { images } = get();
    return new Set(images.map((img) => img.source));
  },

  patchThumbnails: (sourceId, entryPath, thumbnails) =>
    set((state) => {
      let patched = false;
      const images = state.images.map((img) => {
        if (img.sourceId === sourceId && img.relativePath === entryPath) {
          patched = true;
          return { ...img, thumbnails };
        }
        return img;
      });
      if (!patched) return state;
      const key = thumbKey(sourceId, entryPath);
      const requestedThumbs = new Set(state.requestedThumbs);
      requestedThumbs.delete(key);
      return { images, requestedThumbs };
    }),

  markSkipped: (sourceId, entryPath) =>
    set((state) => {
      const key = thumbKey(sourceId, entryPath);
      if (state.skippedThumbs.has(key)) return state;
      const skippedThumbs = new Set(state.skippedThumbs);
      skippedThumbs.add(key);
      const requestedThumbs = new Set(state.requestedThumbs);
      requestedThumbs.delete(key);
      return { skippedThumbs, requestedThumbs };
    }),

  markRequested: (sourceId, entryPath) =>
    set((state) => {
      const key = thumbKey(sourceId, entryPath);
      if (state.requestedThumbs.has(key)) return state;
      const requestedThumbs = new Set(state.requestedThumbs);
      requestedThumbs.add(key);
      return { requestedThumbs };
    }),

  clearRequested: (sourceId, entryPath) =>
    set((state) => {
      const key = thumbKey(sourceId, entryPath);
      if (!state.requestedThumbs.has(key)) return state;
      const requestedThumbs = new Set(state.requestedThumbs);
      requestedThumbs.delete(key);
      return { requestedThumbs };
    }),

  replaceLockedArchive: (archivePath, added) =>
    set((state) => {
      const placeholderSource = `archive:///${archivePath}`;
      const idx = state.images.findIndex(
        (img) => img.locked && img.source === placeholderSource,
      );
      if (idx === -1) return state;
      const images = [
        ...state.images.slice(0, idx),
        ...added,
        ...state.images.slice(idx + 1),
      ];
      const currentIndex = Math.min(
        state.currentIndex,
        Math.max(0, images.length - 1),
      );
      return { images, currentIndex };
    }),
}));
