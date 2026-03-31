import { create } from "zustand";
import type { WImage } from "@/types";

interface ViewerState {
  images: WImage[];
  currentIndex: number;
  isViewerOpen: boolean;
  isScanning: boolean;
  scanId: number;
  totalCount: number;

  appendImages: (newImages: WImage[]) => void;
  setCurrentIndex: (index: number) => void;
  openViewer: (index: number) => void;
  closeViewer: () => void;
  setScanning: (scanning: boolean) => void;
  setTotalCount: (count: number) => void;
  removeImage: (index: number) => void;
  resetAndScan: () => void;
  reset: () => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  images: [],
  currentIndex: 0,
  isViewerOpen: false,
  isScanning: false,
  scanId: 0,
  totalCount: 0,

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
    })),

  reset: () =>
    set({
      images: [],
      currentIndex: 0,
      isViewerOpen: false,
      isScanning: false,
      totalCount: 0,
    }),
}));
