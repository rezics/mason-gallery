## Context

The masonic library virtualizes the masonry grid but relies on DOM measurement (ResizeObserver) to determine each item's rendered height. Items are measured lazily: only when they first enter (or approach) the viewport. When scrolling jumps to an unmeasured region, masonic calculates a `batchSize` of intervening items, renders them all to the DOM for measurement, then re-renders with correct positions. For large collections this batch can be hundreds of items, causing a multi-second freeze.

The application already has image dimensions (width, height) from the Rust scan phase. These dimensions are sufficient to calculate the exact rendered height of each item given the column width: `displayHeight = columnWidth × (image.height / image.width)`. This means the entire masonry layout can be pre-computed without any DOM measurement.

## Goals / Non-Goals

**Goals:**

- Eliminate scroll-jump freezes for collections of any size by pre-populating the masonic positioner with calculated heights
- Show determinate scan progress (count-based) instead of an indeterminate spinner
- Maintain all existing behavior: responsive columns, incremental batch loading, resize handling

**Non-Goals:**

- Replacing the masonic library (we work with its existing API)
- Thumbnail generation or image caching optimizations
- Infinite scroll / paginated loading from the store (all scanned images remain in the store)
- Virtual "windowed array" approach (masonic's interval tree already handles viewport queries efficiently once positions are known)

## Decisions

### Decision 1: Pre-fill positioner in render phase, guarded by index check

**Approach:** After `usePositioner()` returns the positioner and before `useMasonry()` consumes it, iterate over all images and call `positioner.set(index, calculatedHeight)` for any item where `positioner.get(index) === undefined`.

**Why this works:**
- `positioner.set()` is a public API used by masonic's own ResizeObserver callback
- The guard `get(index) === undefined` ensures idempotency — items already positioned are skipped
- Once all items are positioned, `measuredCount === itemCount`, so `needsFreshBatch` is always `false`
- `range()` queries the interval tree in O(log n), returning only visible items

**Alternative considered — useEffect + forceUpdate:** Calling `set()` in an effect would mean the first render still sees `measuredCount < itemCount` and triggers a batch. The synchronous approach avoids this extra render cycle.

**Alternative considered — patching masonic source:** Unnecessary since the public API is sufficient. Avoids maintenance burden of a fork.

### Decision 2: Fallback for images without dimensions

Images with `width === null || height === null` (corrupt headers, unsupported formats) are skipped during pre-fill. Masonic handles these normally via its existing DOM measurement path with `itemHeightEstimate`. This keeps the optimization purely additive.

### Decision 3: Two-phase scan emission from Rust

Split the Rust `scan_directory` flow into two event phases:

1. **`images:count` event** — emitted after directory walk + sort completes, before dimension extraction begins. Payload: `{ total: number }`.
2. **`images:batch` events** — unchanged, emitted as dimensions are extracted per batch.

This gives the frontend an immediate total count for determinate progress display. The walk phase (directory traversal + sort) is fast even for tens of thousands of files. The slow phase (dimension extraction) then runs with the frontend already showing progress.

**Alternative considered — single event with count field:** Adding `total` to the first batch event was considered, but the walk phase must complete before any batch can be emitted (due to sorting), so emitting count separately is cleaner and the frontend receives it sooner.

### Decision 4: Determinate progress in the UI

Replace the indeterminate `LinearProgress` with a determinate variant once `totalCount` is known. Display format: `"{loaded} / {total} images"` during scan.

### Decision 5: Handle positioner recreation on resize

When the container width or column count changes, `usePositioner` creates a new positioner. The pre-fill logic naturally handles this: on the next render, `positioner.size() < images.length` triggers re-computation of all positions with the new column width. This is O(n) but pure arithmetic — 10,000 items takes < 1ms.

## Risks / Trade-offs

**[Risk] Height calculation mismatch with actual DOM height** → The `ImageCell` uses `p-0`, `w-full`, `block` with CSS `aspect-ratio`. The calculated height (`columnWidth * height / width`) should match the rendered height exactly. If CSS changes introduce padding or borders, a sub-pixel discrepancy could cause minor visual drift over many items. Mitigation: masonic's ResizeObserver still fires for rendered items, and its `update()` path corrects positions if actual heights differ.

**[Risk] Synchronous pre-fill blocks render for very large collections** → Pre-filling 100,000 items involves 100,000 `positioner.set()` calls (each doing a shortest-column scan + interval tree insert). For typical column counts (2-6), this is ~1ms per 10,000 items. Mitigation: acceptable for expected collection sizes. If needed in the future, can be chunked with `requestIdleCallback`.

**[Risk] React strict mode double-render** → In development, React may call the render function twice. The `get(index) === undefined` guard ensures the second call is a no-op since items are already positioned. No risk in production.
