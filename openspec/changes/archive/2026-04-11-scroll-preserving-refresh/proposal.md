## Why

The current refresh function (`refresh()` in `scanActions.ts`) performs a full rescan: it clears all images, resets the masonry positioner, re-walks the filesystem, and streams images back from scratch. This causes a blank screen flash, loss of scroll position, and unnecessary I/O — especially painful for large collections. Users who just want to pick up new/deleted files or re-sort shouldn't have to wait for a full reload.

## What Changes

- Add a **scroll-preserving re-layout** capability: re-sort and reset the masonry positioner without clearing images or touching the filesystem, while saving and restoring the user's scroll position.
- Add an **incremental refresh** capability: diff the current image set against a fresh filesystem scan, adding new images and removing deleted ones — without clearing the existing grid.
- Replace the current refresh flow with a two-phase approach:
  1. Instant re-layout (preserves scroll, re-sorts existing images)
  2. Background incremental scan (detects additions/removals)
  3. If changes found, merge into state and re-layout again
- **BREAKING**: The refresh button no longer clears the screen. A separate "Rescan" or folder re-open still performs the full clear-and-reload for cases where the user explicitly wants a clean slate.

## Capabilities

### New Capabilities
- `scroll-preserving-relayout`: Re-layout the masonry grid (re-sort, reset positioner) without clearing images, preserving and restoring scroll position.
- `incremental-refresh`: Diff-based filesystem scan that compares current image paths against disk, adding new files and removing deleted ones without a full reload.

### Modified Capabilities
- `folder-management`: The refresh action changes from "clear everything and rescan" to the two-phase incremental approach. Full reset remains available as a separate action.

## Impact

- **`packages/core/src/lib/scanActions.ts`**: New `incrementalRefresh()` function replacing current `refresh()` logic; new `relayout()` function.
- **`packages/core/src/stores/viewerStore.ts`**: New actions for removing images by path, merging new images without clearing, and bumping `scanId` without resetting the image array.
- **`packages/core/src/components/WaterfallGrid.tsx`**: Scroll position save/restore around positioner resets.
- **`packages/core/src/components/MenuBar.tsx`**: Refresh button wired to new incremental flow.
- **Platform services** (`TauriPlatformService`, `WebPlatformService`): May need a lightweight "list paths only" scan mode for diffing, or reuse existing scan with post-diff logic.
