import { create } from "zustand";

interface AppState {
  folders: string[];
  isSettingsOpen: boolean;

  setFolders: (folders: string[]) => void;
  setSettingsOpen: (open: boolean) => void;
  toggleSettings: () => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  folders: [],
  isSettingsOpen: false,

  setFolders: (folders) => set({ folders }),
  setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
  toggleSettings: () =>
    set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
  reset: () => set({ folders: [], isSettingsOpen: false }),
}));
