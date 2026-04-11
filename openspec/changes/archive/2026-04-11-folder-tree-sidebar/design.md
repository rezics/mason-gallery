## Context

The current data pipeline is: Rust `scan_directory` → flat `WImage[]` → viewerStore → WaterfallGrid. Directory structure information is available during scanning but discarded. The Web platform's `walkDirectory` generator yields `{ name, path, handle }` but only `handle` survives into the final WImage.

Users select folders via DropZone (drag-and-drop or native dialog). After selection, all images from the entire tree appear in a single flat grid. There is no concept of "current subfolder" or directory navigation.

MUI 7 provides `TreeView` (or the newer `RichTreeView`) for tree rendering. The project already uses MUI's `Drawer` pattern in the settings panel.

## Goals / Non-Goals

**Goals:**
- Preserve directory path information in the image data model
- Provide a fast directory-tree-only query (before full image scan completes)
- Let users browse and filter images by subfolder
- Collapsible sidebar that works at all viewport sizes

**Non-Goals:**
- Drag-and-drop reordering of folders
- Multi-folder selection (filtering by multiple non-nested folders simultaneously)
- Folder-level operations (rename, delete, create)
- Virtual file system or indexing/caching layer
- Changing how the lightbox viewer navigates (remains global index across all images)

## Decisions

### 1. Add `relativePath` to WImage

**Decision**: Add `relativePath: string` to the WImage interface. It stores the path relative to the scanned root, e.g., `"2024/January/photo.jpg"`. The directory portion is derived by stripping the filename.

**Alternatives considered**:
- *Separate `directory` field*: Redundant — `relativePath` already contains the directory. Extracting it is trivial (`relativePath.substring(0, relativePath.lastIndexOf("/"))`).
- *Store a tree structure in the image data*: Over-engineering. A flat string lets us filter with `startsWith` and build the tree on-demand.

**Rationale**: Minimal data model change. Both Rust and Web already have this information during scanning — we just stop discarding it.

### 2. Frontend filtering (not re-scanning)

**Decision**: All images remain in `viewerStore.images[]`. Selecting a folder computes a derived filtered view via `images.filter(img => img.relativePath.startsWith(selectedFolder + "/"))`. The masonry grid receives the filtered array.

**Alternatives considered**:
- *Re-scan per folder*: Adds latency on every folder switch. Wastes the already-loaded data.
- *Separate store per folder*: Memory-intensive for deep trees, complex invalidation.

**Rationale**: A WImage is ~200 bytes. 10,000 images = 2MB. Filtering a 10k array takes <1ms. This is the simplest approach with the best UX (instant folder switching).

### 3. Hybrid directory tree loading (Timing C)

**Decision**: Two-phase approach:
1. On scan start, call `listDirectoryTree` (new command) to get the directory skeleton instantly. Sidebar renders immediately.
2. As `images:batch` events arrive, increment per-folder image counts. The sidebar shows counts updating progressively.

**Alternatives considered**:
- *Build tree only from image paths*: Tree appears gradually as batches arrive. First render may be incomplete or flash.
- *Separate tree-only request*: Tree is complete immediately but counts are unknown until scan finishes.

**Rationale**: Timing C combines the strengths — immediate structural navigation with progressive count enrichment.

### 4. New Rust command `list_directory_tree`

**Decision**: A lightweight Tauri command that uses `walkdir` to collect only directory paths (skipping files), returning them as a flat list of relative paths. The frontend builds the tree structure from the flat list.

```
Input:  { paths: ["/Users/me/Photos"], recursive: true }
Output: { directories: ["2024", "2024/January", "2024/February", "2023", "2023/Vacation"] }
```

**Alternatives considered**:
- *Return a nested tree from Rust*: More complex serialization, harder to diff/update.
- *No separate command, parse from scan results*: Tree isn't available until images start arriving.

**Rationale**: Flat list of paths is simple to serialize, fast to transmit, and the frontend can build any tree representation it needs. Walking directories without reading files is nearly instantaneous even for deep trees.

### 5. Web platform equivalent

**Decision**: `WebPlatformService.listDirectoryTree()` recursively enumerates `FileSystemDirectoryHandle` entries, collecting only directory-kind entries. Returns the same flat list of relative paths.

**Rationale**: Mirrors the desktop API. No file reads needed — just directory enumeration, which is fast via the File System Access API.

### 6. Directory state management

**Decision**: Extend `useAppStore` with:
- `directoryTree: string[]` — flat list of relative directory paths
- `selectedFolder: string | null` — currently selected folder path (null = show all)
- `expandedFolders: Set<string>` — expanded nodes in the tree UI
- `folderImageCounts: Map<string, number>` — image count per folder, updated incrementally

Not a new store — this is application-level state, not settings or viewer state.

**Alternatives considered**:
- *New `useFolderStore`*: Adds another store. The folder state is tightly coupled with app-level concerns (selected paths, scan state).
- *Inside viewerStore*: viewerStore is for image/viewer runtime state, not navigation.

**Rationale**: `useAppStore` already manages folder paths and UI flags. Directory navigation is a natural extension.

### 7. Sidebar UI: MUI Drawer (persistent variant)

**Decision**: Use MUI `Drawer` with `variant="persistent"` anchored to the left. A toggle button in the titlebar or stats bar collapses/expands it. Inside, use MUI `TreeView` (or `SimpleTreeView`) for the folder hierarchy. Default state: collapsed (sidebar hidden) until user opens it.

**Alternatives considered**:
- *Temporary drawer (overlay)*: Blocks grid content while open. Bad for "browse while filtering."
- *Always-visible sidebar*: Wastes space when users don't need folder navigation.
- *Custom tree component*: MUI TreeView already handles expand/collapse, keyboard navigation, and accessibility.

**Rationale**: Persistent drawer pushes grid content aside, letting users see both tree and grid simultaneously. Collapsible by default respects screen space. MUI TreeView provides a11y and keyboard support out of the box.

### 8. Filtered images and viewer index

**Decision**: The masonry grid receives filtered images. When the user clicks an image in the filtered grid, `openViewer` receives the **global index** (the image's position in the full unfiltered `images[]` array). The viewer navigates through all images globally, not just the filtered set.

**Rationale**: User's explicit preference. Avoids rebuilding the viewer's slide array on every folder change. Can be revisited later if UX feedback warrants filtered navigation.

## Risks / Trade-offs

- **[Large directory trees]** → A folder with 10,000+ subdirectories could make the sidebar unwieldy. Mitigation: TreeView virtualizes rendering; deep branches are collapsed by default. Can add a search/filter for the tree itself in a future iteration.
- **[relativePath format divergence]** → Desktop uses OS path separators (`\` on Windows), Web uses `/`. Mitigation: normalize to forward slashes in both platforms before storing in WImage.
- **[File System Access API limitations]** → Web's directory enumeration is async and may be slow for very deep trees. Mitigation: show a loading indicator in the sidebar; the tree is still faster than full image scanning.
- **[Filtering performance at scale]** → `Array.filter` on 50,000 images with `startsWith` is still <5ms. Not a real concern, but if it becomes one, a pre-built index (Map<folder, indices>) is straightforward to add.
- **[Layout shift on sidebar toggle]** → Opening/closing the sidebar resizes the grid container, triggering a masonry relayout. Mitigation: the existing `useContainerSize` + ResizeObserver already handles this; positioner recalculates column layout on width change.
