import { create } from "zustand";
import type { WImage } from "@/types";

interface ViewerState {
  images: WImage[];
  currentIndex: number;
  isViewerOpen: boolean;
  isScanning: boolean;
  scanId: number;
  totalCount: number;
  isRelayout: boolean;

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
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  images: [],
  currentIndex: 0,
  isViewerOpen: false,
  isScanning: false,
  scanId: 0,
  totalCount: 0,
  isRelayout: false,

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
    })),

  reset: () =>
    set({
      images: [],
      currentIndex: 0,
      isViewerOpen: false,
      isScanning: false,
      totalCount: 0,
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
}));
