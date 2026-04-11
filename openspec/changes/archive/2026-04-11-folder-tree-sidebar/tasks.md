## 1. Data Model: Add relativePath to WImage

- [x] 1.1 Add `relativePath: string` to the `WImage` TypeScript interface in `packages/core/src/types/index.ts`
- [x] 1.2 Add `relative_path: String` to the Rust `WImage` struct in `commands.rs`; compute it by stripping the scanned root prefix from each file's absolute path; normalize to forward slashes
- [x] 1.3 Update `WebPlatformService.scanImages` to preserve the `path` from `walkDirectory` into `WImage.relativePath` instead of discarding it
- [x] 1.4 Update `TauriPlatformService` to pass through the new `relativePath` field from Rust events

## 2. Rust: list_directory_tree Command

- [x] 2.1 Implement `list_directory_tree` Tauri command in `commands.rs`: accept root paths, use `walkdir` filtering to directory entries only, return flat list of relative paths (forward slashes)
- [x] 2.2 Register the command in `tauri.conf.json` and the Tauri builder
- [x] 2.3 Add `listDirectoryTree` to the `PlatformService` interface in `packages/core/src/types/platform.ts`
- [x] 2.4 Implement `listDirectoryTree` in `TauriPlatformService` — invoke the Tauri command and return the result
- [x] 2.5 Implement `listDirectoryTree` in `WebPlatformService` — recursively enumerate `FileSystemDirectoryHandle` for directory-kind entries only

## 3. State Management: Directory Tree State

- [x] 3.1 Add directory tree state to `useAppStore`: `directoryTree: string[]`, `selectedFolder: string | null`, `expandedFolders: string[]`, `folderImageCounts: Record<string, number>`
- [x] 3.2 Add actions: `setDirectoryTree`, `setSelectedFolder`, `toggleExpandedFolder`, `updateFolderCounts`, `resetDirectoryState`
- [x] 3.3 Update `scanActions.ts` to call `listDirectoryTree` at scan start and populate `directoryTree`; update `folderImageCounts` incrementally in the `onBatch` callback by extracting directory from each image's `relativePath`

## 4. Folder Sidebar Component

- [x] 4.1 Create `FolderSidebar` component using MUI `Drawer` (variant="persistent") with MUI `SimpleTreeView` for the folder hierarchy
- [x] 4.2 Build tree data structure from the flat `directoryTree` path list; render with expand/collapse; display `folderImageCounts` next to each node
- [x] 4.3 Wire folder click to `setSelectedFolder`; highlight the selected node; add "Show All" root option that sets `selectedFolder` to null
- [x] 4.4 Add responsive behavior: use temporary (overlay) drawer variant when viewport width < 768px

## 5. Grid Filtering Integration

- [x] 5.1 In `HomePage.tsx`, compute `filteredImages` from `viewerStore.images` filtered by `selectedFolder` (using `relativePath.startsWith`); pass to WaterfallGrid
- [x] 5.2 Update WaterfallGrid to accept an `images` prop (or derive from filtered source) instead of reading directly from viewerStore
- [x] 5.3 Update `openViewer` calls in ImageCell to pass the global index (position in unfiltered `viewerStore.images[]`), not the filtered array index
- [x] 5.4 Update HomePage layout to flex-row with sidebar + grid content area; handle sidebar toggle resizing the grid container

## 6. UI Polish and i18n

- [x] 6.1 Add sidebar toggle button to the titlebar or stats bar area
- [x] 6.2 Add i18n keys for sidebar UI: "Folders", "Show All", "No subfolders", folder count format (en/zh)
- [x] 6.3 Ensure sidebar toggle state and expanded folders survive folder re-scans (but reset on new root folder selection)
