## Context

Currently, `refresh()` in `scanActions.ts` calls `resetAndScan()` which increments `scanId`, clears the entire `images` array, sets `isScanning = true`, then re-invokes the platform's `scanImages()`. The masonry grid in `WaterfallGrid.tsx` uses `scanId` as a dependency for `usePositioner()`, so incrementing it destroys all cached layout measurements. The result: blank screen, full filesystem walk, images stream back in batches, scroll resets to top.

For large collections (10k+ images), this takes several seconds and feels disruptive when the user just wants to pick up a few new files or re-sort.

## Goals / Non-Goals

**Goals:**
- Refresh the grid without clearing images or losing scroll position
- Detect added/removed files incrementally via path diffing
- Keep the full rescan available for explicit folder re-opens or "hard reset"
- Maintain progressive batch loading for the initial scan (unchanged)

**Non-Goals:**
- Detecting modified files (changed content at same path) — out of scope for now
- Thumbnail caching or incremental dimension extraction — future optimization
- Changing the Rust `scan_directory` command interface (reuse existing output, diff in JS)

## Decisions

### Decision 1: Two-phase refresh flow

**Choice**: Refresh = instant re-layout → background incremental scan → conditional re-layout.

**Rationale**: Gives immediate visual feedback (re-sort is instant) while the heavier I/O happens in background. If nothing changed on disk, the user never notices the scan. If files were added/removed, a second re-layout merges them smoothly.

**Alternative considered**: Single-phase incremental scan only. Rejected because re-sorting existing images shouldn't require any I/O at all — separating the two concerns keeps each phase simple.

### Decision 2: Diff by file path set

**Choice**: Compare `Set<string>` of current image `source` paths against paths returned by a new scan. New paths = additions, missing paths = removals.

**Rationale**: File path is the natural unique key already used everywhere. No need for checksums or mtimes for the add/remove detection use case.

**Alternative considered**: Use file modification timestamps. Adds complexity and doesn't help with the core add/remove case. Could be layered on later for "modified file" detection.

### Decision 3: Reuse existing scan infrastructure for diffing

**Choice**: Run the same `scanImages()` call for the incremental scan, then diff results against current state in the store. No new Rust command needed.

**Rationale**: The existing scan already returns all paths with dimensions. Building a separate "list paths only" Rust command adds maintenance burden for marginal performance gain. The scan is already batched and non-blocking.

**Alternative considered**: Add a lightweight `list_paths` Tauri command that skips dimension extraction. Better performance but more Rust surface area. Can optimize later if profiling shows the dimension extraction is the bottleneck during incremental refresh.

### Decision 4: Scroll position save/restore in WaterfallGrid

**Choice**: Before bumping `scanId` for re-layout, capture the container's `scrollTop`. After the positioner resets and React re-renders, restore `scrollTop` in a `useLayoutEffect`.

**Rationale**: `useLayoutEffect` fires synchronously after DOM mutations but before paint, so the user never sees a scroll jump. The masonry pre-fill logic already ensures positions are computed before render, so restoring scroll to the same pixel offset keeps the same images in view.

### Decision 5: Store-level separation of concerns

**Choice**: Add new viewerStore actions:
- `relayout()` — bumps `scanId` only (no image clear)
- `mergeImages(added, removedPaths)` — splices new images in, filters out removed paths
- Keep existing `resetAndScan()` for full reloads

**Rationale**: Clean separation between "layout refresh" and "data refresh". The existing `resetAndScan()` remains untouched for folder changes and explicit hard resets.

## Risks / Trade-offs

- **[Scroll offset drift]** After adding/removing images above the current viewport, the same `scrollTop` pixel value may show different images. → Mitigation: acceptable for incremental changes (few images added/removed). For large deltas, the slight drift is better than resetting to top.

- **[Race condition on rapid refresh]** User clicks refresh twice quickly — two incremental scans could interleave. → Mitigation: Use the existing `scanId` as a generation counter; discard results from stale scans.

- **[Memory during diff]** Building a full path set for diffing doubles memory briefly for the path strings. → Mitigation: negligible for even 100k paths (a few MB of strings). Not a practical concern.

- **[Dimension re-extraction on add]** New files discovered incrementally still need dimension extraction via the full scan pipeline. → Acceptable: only new files pay this cost, not the entire collection.
