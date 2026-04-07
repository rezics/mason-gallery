## Why

When viewing large image collections (thousands of images), scrolling—especially jumping to a distant scroll position—causes the UI to freeze for several seconds. This is because the `masonic` library uses DOM measurement to determine item heights, and when scrolling to unmeasured regions it must batch-render and measure all intervening items before it can display the target viewport. Since the application already knows every image's dimensions from the scan phase, this DOM measurement is entirely redundant and the freeze is avoidable.

## What Changes

- Pre-populate the masonic positioner with calculated item heights derived from known image dimensions, eliminating the need for DOM-based measurement and the "batch catch-up" freeze on scroll jumps.
- Add a determinate progress indicator during scanning so users see concrete progress (e.g., "3,200 / 12,847 images") instead of an indeterminate spinner.
- Ensure the waterfall grid remains responsive during incremental image loading (new batches arriving) and container resizes (column count changes) without layout regression.

## Capabilities

### New Capabilities

- `masonry-pre-positioning`: Pre-calculate and fill masonic positioner positions using known image dimensions before rendering, bypassing DOM measurement for all items with known width/height.

### Modified Capabilities

- `waterfall-view`: Add requirement for scroll-jump performance — the grid must handle instant jumps to arbitrary scroll positions without freezing, even with 10,000+ items.
- `state-management`: Add a `totalCount` field to the viewer store so the UI can show determinate scan progress.
- `rust-file-engine`: Emit total file count after the directory walk phase (before dimension extraction) so the frontend can display determinate progress immediately.

## Impact

- **Code**: Primary changes in `WaterfallGrid.tsx` (pre-positioning logic), `viewerStore.ts` (total count), `commands.rs` (early count emission), and `HomePage.tsx` (progress display).
- **Dependencies**: No new dependencies. No changes to `masonic` library source.
- **Risk**: Low — the positioner's `set()` API is public and already used by masonic's own resize observer. Pre-filling it is a supported usage pattern. Fallback to default behavior for images without known dimensions.
