import { create } from "zustand";

interface AppState {
  folders: string[];
  isSettingsOpen: boolean;
  isSidebarOpen: boolean;
  directoryTree: string[];
  selectedFolder: string | null;
  expandedFolders: string[];
  folderImageCounts: Record<string, number>;

  setFolders: (folders: string[]) => void;
  setSettingsOpen: (open: boolean) => void;
  toggleSettings: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setDirectoryTree: (tree: string[]) => void;
  setSelectedFolder: (folder: string | null) => void;
  toggleExpandedFolder: (folder: string) => void;
  updateFolderCounts: (counts: Record<string, number>) => void;
  resetDirectoryState: () => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  folders: [],
  isSettingsOpen: false,
  isSidebarOpen: false,
  directoryTree: [],
  selectedFolder: null,
  expandedFolders: [],
  folderImageCounts: {},

  setFolders: (folders) => set({ folders }),
  setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
  toggleSettings: () =>
    set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setDirectoryTree: (directoryTree) => set({ directoryTree }),
  setSelectedFolder: (selectedFolder) => set({ selectedFolder }),
  toggleExpandedFolder: (folder) =>
    set((state) => {
      const expanded = state.expandedFolders.includes(folder)
        ? state.expandedFolders.filter((f) => f !== folder)
        : [...state.expandedFolders, folder];
      return { expandedFolders: expanded };
    }),
  updateFolderCounts: (counts) =>
    set((state) => {
      const merged = { ...state.folderImageCounts };
      for (const [folder, count] of Object.entries(counts)) {
        merged[folder] = (merged[folder] ?? 0) + count;
      }
      return { folderImageCounts: merged };
    }),
  resetDirectoryState: () =>
    set({
      directoryTree: [],
      selectedFolder: null,
      expandedFolders: [],
      folderImageCounts: {},
    }),
  reset: () =>
    set({
      folders: [],
      isSettingsOpen: false,
      isSidebarOpen: false,
      directoryTree: [],
      selectedFolder: null,
      expandedFolders: [],
      folderImageCounts: {},
    }),
}));
