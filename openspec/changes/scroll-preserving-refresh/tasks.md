## 1. Store Actions

- [x] 1.1 Add `relayout()` action to `viewerStore` that increments `scanId` without clearing images or setting `isScanning`
- [x] 1.2 Add `mergeImages(added: WImage[], removedPaths: Set<string>)` action to `viewerStore` that appends new images and filters out removed paths
- [x] 1.3 Add `getCurrentPaths()` selector or helper that returns a `Set<string>` of all current image source paths

## 2. Scroll Position Preservation

- [x] 2.1 In `WaterfallGrid.tsx`, add scroll position save/restore logic around `scanId` changes — capture `scrollTop` before positioner reset, restore in `useLayoutEffect`
- [x] 2.2 Distinguish between full-reset scans (scroll to top) and re-layouts (preserve scroll) using a flag or ref

## 3. Incremental Refresh Logic

- [x] 3.1 Create `incrementalRefresh()` function in `scanActions.ts` implementing the two-phase flow: instant re-layout → background scan → diff → conditional merge + re-layout
- [x] 3.2 Implement path diffing: compare `getCurrentPaths()` against scan results to compute `added` and `removedPaths` sets
- [x] 3.3 Add stale scan guard using `scanId` — discard results if `scanId` has changed since the scan started

## 4. Wire Up UI

- [x] 4.1 Update `MenuBar.tsx` refresh button to call `incrementalRefresh()` instead of `refresh()`
- [x] 4.2 Ensure full reset (folder re-open, `resetToDropZone`) still uses the existing `resetAndScan()` flow

## 5. Verification

- [x] 5.1 Test: refresh with no filesystem changes — grid re-layouts, scroll preserved, no blank flash
- [x] 5.2 Test: add new images to folder, refresh — new images appear without clearing existing ones
- [x] 5.3 Test: delete images from folder, refresh — deleted images removed, scroll preserved
- [x] 5.4 Test: rapid double-refresh — only latest scan results applied
