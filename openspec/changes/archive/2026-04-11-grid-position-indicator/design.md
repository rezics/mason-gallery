## Context

The masonry grid (WaterfallGrid.tsx) uses Masonic's `useMasonry` + `usePositioner` for virtualized rendering. The existing stats bar in HomePage.tsx shows `{loaded} / {total}` during scanning and `{count} images` when complete. The positioner is currently scoped inside WaterfallGrid and not accessible externally.

Masonic provides a `useScrollToIndex` hook that accepts a positioner and scroll container, returning a `scrollToIndex(n)` callback. The project already pre-fills the positioner with calculated heights for all images, so `useScrollToIndex` can jump precisely to any index without estimation fallback.

The lightbox viewer (yet-another-react-lightbox) ships an official Counter plugin that displays `currentIndex / total` with zero custom code.

## Goals / Non-Goals

**Goals:**
- Show approximate current scroll position as an image index in the stats bar
- Let users jump to any image index via input
- Optionally show counter in lightbox viewer
- All new UI toggleable via settings

**Non-Goals:**
- Thumbnail-based scrubber or minimap
- Scroll-to-image-by-name or search functionality
- Precise (pixel-perfect) current index — approximate is sufficient

## Decisions

### 1. Expose positioner via ref callback

**Decision**: WaterfallGrid will accept an optional `onPositionerReady(positioner, columnCount)` callback prop. HomePage calls `useScrollToIndex` with the received positioner.

**Alternatives considered**:
- *React context*: Overkill for a single consumer. Adds provider nesting.
- *Zustand store*: Positioner is a mutable object with internal state; storing it in Zustand breaks its reactivity model.
- *Move stats bar inside WaterfallGrid*: Violates separation — the stats bar is a page-level concern that also shows scan progress.

**Rationale**: A callback prop is the simplest way to lift the positioner without restructuring. HomePage already owns the scrollContainerRef that WaterfallGrid needs, so data already flows between them.

### 2. Approximate current index via average row height

**Decision**: Compute `currentIndex ≈ Math.round(scrollTop / (totalHeight / itemCount) * columnCount)` clamped to `[0, images.length - 1]`.

**Alternatives considered**:
- *Binary search on positioner items*: More accurate but positioner doesn't expose a sorted-by-top iteration API. Would require accessing internal data structures.
- *Intersection Observer on cells*: Unreliable with virtualized rendering (DOM nodes are recycled).

**Rationale**: For a position indicator, ±5 images of accuracy is fine. The formula is O(1) and doesn't depend on positioner internals. `totalHeight` can be derived from `positioner.shortestColumn()` or similar, and `itemCount` from `positioner.size()`.

### 3. Jump input as inline expandable field

**Decision**: The stats bar shows `~420 / 1,280`. Clicking the indicator or pressing a keyboard shortcut (e.g., `Ctrl+G`) expands an inline number input. Enter confirms and scrolls; Escape cancels.

**Rationale**: Avoids a separate dialog or modal. Keeps the interaction lightweight and in-context. The input replaces the `now` portion temporarily: `[___] / 1,280 [Go]`.

### 4. Lightbox counter via official Counter plugin

**Decision**: Import and add the Counter plugin from `yet-another-react-lightbox/plugins/counter`. No custom rendering needed.

**Rationale**: Zero-effort implementation. The plugin renders `currentIndex / total` in the toolbar area. Styling can be adjusted via CSS if needed.

### 5. Setting stored in settingsStore

**Decision**: Add `showGridPosition: boolean` (default: `true`) to settingsStore. Controls visibility of the position indicator and jump input in the stats bar. The lightbox counter is always shown (it's unobtrusive).

**Rationale**: Users who find the stats bar cluttered can disable it. Persisted via the existing platform settings mechanism.

## Risks / Trade-offs

- **[Approximate index inaccuracy]** → The average-height formula can drift significantly when image aspect ratios vary widely (e.g., mix of panoramas and portraits). Mitigation: prefix with `~` to signal approximation. This is acceptable for the use case.
- **[Positioner ref timing]** → The positioner is recreated when `scanId` or `columnCount` changes. The callback must handle updates. Mitigation: call `onPositionerReady` in a `useEffect` that depends on the positioner instance.
- **[useScrollToIndex element type]** → Masonic's `useScrollToIndex` defaults to `window` as scroll target. We use a container div. Must pass `element: scrollContainerRef` explicitly. Mitigation: already verified the hook accepts RefObject<HTMLElement>.
