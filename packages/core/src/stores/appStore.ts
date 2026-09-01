import { create } from "zustand";

interface AppState {
  folders: string[];
  isQuickPanelOpen: boolean;
  isSidebarOpen: boolean;
  /** App navigation sidebar in AppShell. Distinct from the gallery folder sidebar. */
  isAppSidebarOpen: boolean;
  /** Measured gallery pane width used by the masonry grid. Null when unmounted. */
  galleryLayoutWidth: number | null;
  directoryTree: string[];
  selectedFolder: string | null;
  expandedFolders: string[];
  folderImageCounts: Record<string, number>;

  // Archive-related state
  archivePath: string | null;
  archivePasswordNeeded: string | null;
  archiveMasterPasswordNeeded: string | null;
  archiveSolidWarning: string | null;
  archiveMigrationCandidate: {
    archiveId: number;
    oldPath: string;
    newPath: string;
  } | null;

  setFolders: (folders: string[]) => void;
  setQuickPanelOpen: (open: boolean) => void;
  toggleQuickPanel: () => void;
  setSidebarOpen: (open: boolean) => void;
  setAppSidebarOpen: (open: boolean) => void;
  setGalleryLayoutWidth: (width: number | null) => void;
  toggleSidebar: () => void;
  toggleAppSidebar: () => void;
  setDirectoryTree: (tree: string[]) => void;
  setSelectedFolder: (folder: string | null) => void;
  toggleExpandedFolder: (folder: string) => void;
  updateFolderCounts: (counts: Record<string, number>) => void;
  resetDirectoryState: () => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  folders: [],
  isQuickPanelOpen: false,
  isSidebarOpen: false,
  isAppSidebarOpen: true,
  galleryLayoutWidth: null,
  directoryTree: [],
  selectedFolder: null,
  expandedFolders: [],
  folderImageCounts: {},
  archivePath: null,
  archivePasswordNeeded: null,
  archiveMasterPasswordNeeded: null,
  archiveSolidWarning: null,
  archiveMigrationCandidate: null,

  setFolders: (folders) => set({ folders }),
  setQuickPanelOpen: (isQuickPanelOpen) => set({ isQuickPanelOpen }),
  toggleQuickPanel: () =>
    set((state) => ({ isQuickPanelOpen: !state.isQuickPanelOpen })),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  setAppSidebarOpen: (isAppSidebarOpen) => set({ isAppSidebarOpen }),
  setGalleryLayoutWidth: (galleryLayoutWidth) =>
    set((state) =>
      state.galleryLayoutWidth === galleryLayoutWidth
        ? state
        : { galleryLayoutWidth },
    ),
  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleAppSidebar: () =>
    set((state) => ({ isAppSidebarOpen: !state.isAppSidebarOpen })),
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
      isQuickPanelOpen: false,
      isSidebarOpen: false,
      galleryLayoutWidth: null,
      directoryTree: [],
      selectedFolder: null,
      expandedFolders: [],
      folderImageCounts: {},
      archivePath: null,
      archivePasswordNeeded: null,
      archiveMasterPasswordNeeded: null,
      archiveSolidWarning: null,
      archiveMigrationCandidate: null,
    }),
}));
