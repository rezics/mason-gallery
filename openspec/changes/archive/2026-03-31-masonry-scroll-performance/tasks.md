## 1. Rust Backend: Two-Phase Scan Emission

- [x] 1.1 In `commands.rs`, emit an `images:count` event with `{ total: entries.len() }` after directory walk + sort completes, before the batch loop begins
- [x] 1.2 Add the `ImageCount` struct for the count event payload

## 2. Frontend State: Viewer Store

- [x] 2.1 Add `totalCount: number` field and `setTotalCount` action to `useViewerStore`
- [x] 2.2 Reset `totalCount` to 0 in `resetAndScan()` and `reset()`

## 3. Platform Service: Count Event Wiring

- [x] 3.1 In `TauriPlatformService`, listen for `images:count` event and expose it via a new callback parameter in `scanImages()`
- [x] 3.2 In `WebPlatformService`, emit the total count after file discovery completes (before dimension extraction)
- [x] 3.3 Update `scanActions.ts` to pass an `onCount` callback that calls `setTotalCount`

## 4. Masonry Pre-Positioning

- [x] 4.1 In `WaterfallGrid.tsx`, add pre-fill logic between `usePositioner()` and `useMasonry()`: iterate images, compute `columnWidth * (height / width)` for items with known dimensions, call `positioner.set(i, height)` for items where `positioner.get(i) === undefined`
- [x] 4.2 Verify that the `get(index) === undefined` guard prevents double-insertion on React re-renders

## 5. UI: Determinate Progress

- [x] 5.1 In `HomePage.tsx`, replace the indeterminate `LinearProgress` with a determinate variant when `totalCount > 0`, using `value = (images.length / totalCount) * 100`
- [x] 5.2 Update the scanning status text to show `"{loaded} / {total} images"` format

## 6. Verification

- [x] 6.1 Test with a large image collection (5,000+ images): confirm scroll jumps are instant with no freeze
- [x] 6.2 Test incremental loading: confirm grid updates smoothly as batches arrive during scan
- [x] 6.3 Test window resize: confirm column count changes re-fill positions without scroll issues
- [x] 6.4 Test with images that have null dimensions: confirm they still render via masonic's fallback measurement
- [x] 6.5 Run `bun run check` to verify no type errors or lint issues
