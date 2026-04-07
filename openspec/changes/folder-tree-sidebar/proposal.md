## Why

After selecting a folder, all images from the entire directory tree are displayed as a flat masonry grid with no directory structure. Users with organized photo libraries (e.g., `Photos/2024/January/`) have no way to browse by subfolder, see the directory hierarchy, or filter images to a specific directory. For large collections, this makes the tool impractical for anything beyond "show me everything."

## What Changes

- Add a `relativePath` field to the `WImage` data model, preserving the directory path relative to the scanned root during both Rust and Web scanning
- Add a new Rust command `list_directory_tree` that returns only the directory structure (no image scanning) for fast sidebar population
- Add a collapsible tree sidebar (MUI Drawer) showing the folder hierarchy of the scanned directory
- Implement client-side image filtering: clicking a folder shows only images within that folder and its children
- Display per-folder image counts in the sidebar (populated incrementally as images load)
- Add directory tree state management (tree structure, selected folder, expanded nodes)

## Capabilities

### New Capabilities
- `directory-tree`: Directory tree data model, Rust command for fast tree retrieval, and Web equivalent
- `folder-sidebar`: Collapsible sidebar UI with tree navigation, folder selection, and per-folder image counts

### Modified Capabilities
- `rust-file-engine`: `WImage` gains `relativePath` field; new `list_directory_tree` command added
- `waterfall-view`: Grid displays filtered images based on selected folder (or all images when no folder selected)
- `state-management`: New state for directory tree, selected folder, and expanded nodes

## Impact

- **packages/desktop/src-tauri/src/commands.rs** — Add `relativePath` to WImage struct; add `list_directory_tree` command; modify `scan_directory` to compute relative paths
- **packages/core/src/types/index.ts** — Add `relativePath` to WImage interface
- **packages/core/src/types/platform.ts** — Add `listDirectoryTree` method to PlatformService; update `scanImages` to populate relativePath
- **packages/desktop/src/adapters/TauriPlatformService.ts** — Implement `listDirectoryTree` via Tauri command; handle new WImage field
- **packages/web/src/adapters/WebPlatformService.ts** — Implement `listDirectoryTree` via recursive FileSystemDirectoryHandle traversal; preserve relativePath in scanImages
- **packages/core/src/stores/** — New store or appStore extension for directory tree state
- **packages/core/src/components/** — New FolderSidebar component with MUI TreeView
- **packages/core/src/pages/HomePage.tsx** — Layout change: sidebar + grid in flex row
- **packages/core/src/i18n/** — New translation keys for sidebar UI
- **packages/desktop/src-tauri/tauri.conf.json** — Register new Tauri command
