import { create } from "zustand";
import type { DropBatch, DroppedSource, LibraryEffect } from "@/types/platform";

export interface DropChoiceState {
  sources: DroppedSource[];
  persistOthers: boolean;
}

interface DropUiState {
  exclusiveHandler: ((batch: DropBatch) => void) | null;
  blockCount: number;
  isHovering: boolean;
  pendingChoice: DropChoiceState | null;
  registerExclusive: (handler: (batch: DropBatch) => void) => () => void;
  beginBlock: () => () => void;
  setHovering: (isHovering: boolean) => void;
  setPendingChoice: (pendingChoice: DropChoiceState | null) => void;
}

export const useDropStore = create<DropUiState>((set) => ({
  exclusiveHandler: null,
  blockCount: 0,
  isHovering: false,
  pendingChoice: null,

  registerExclusive: (handler) => {
    set({ exclusiveHandler: handler });
    return () =>
      set((state) =>
        state.exclusiveHandler === handler ? { exclusiveHandler: null } : state,
      );
  },

  beginBlock: () => {
    set((state) => ({ blockCount: state.blockCount + 1 }));
    return () =>
      set((state) => ({ blockCount: Math.max(0, state.blockCount - 1) }));
  },

  setHovering: (isHovering) => set({ isHovering }),
  setPendingChoice: (pendingChoice) => set({ pendingChoice }),
}));

export type { LibraryEffect };
