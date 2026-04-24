## Why

After `restructure-image-delivery` establishes the thumb/original delivery split, the `sources` schema, and the service layer, thumbnails are still only generated for archive entries. Regular folder images bypass the pipeline: masonry loads full-resolution originals even for tiny preview tiles, wasting bandwidth and memory on large collections. Meanwhile, users frequently store image packs as a mix of loose images **and** compressed archives inside the same folder — today each archive has to be opened separately.

This change closes both gaps at once. Folder images gain optional on-demand thumbnails using a lazy, viewport-triggered pipeline (no bulk upfront generation). Archives discovered during a folder scan are transparently expanded as inline virtual sources, so a mixed folder presents a single unified grid containing both loose-file entries and archive entries, each using whichever delivery mode is appropriate.

The lazy pipeline is deliberate: eager generation of 10 000 thumbnails on scan would saturate the CPU and produce work the user may never see. A carefully throttled viewport + dwell-time trigger keeps generation proportional to actual use.

## What Changes

- Add a `folderThumbnails` user setting with modes `"off"` (default) and `"lazy"`. When `"off"`, folder images are served as originals exactly as they are today (post-change-1). When `"lazy"`, thumbnails are generated on demand as images enter the viewport.
- Extend the `thumbnail_service` with `generate_for_file(source_id, file_path, widths[])` — generates and persists thumbnails for filesystem images, honoring the `cachePolicy.extracted.minFileSize` threshold (repurposed as the thumbnail-generation threshold for folder files; files below it skip thumbnail generation entirely).
- Add a Tauri command `request_thumbnail(sourceId, entryPath)` that enqueues a generation task. Completed thumbnails SHALL be emitted via an `images:thumbnails` event so the frontend store can patch affected `ImageEntry` records.
- Add a Tauri command `cancel_thumbnail(sourceId, entryPath)` that removes an entry from the queue (if still pending) or sets a cancellation flag (if in-flight). The service layer checks the flag cooperatively.
- Implement a priority queue in `thumbnail_service`: LIFO order (most recently requested runs first — matches "user just paused there"), concurrency-limited by semaphore (`max 4` in flight), de-duplicated by `(source_id, entry_path)`.
- Add a frontend coordinator in `packages/core` that wires `IntersectionObserver` + a 150ms dwell timer + cancellation + deduplication. On mount, each grid tile starts an observer; it requests a thumbnail only after the tile has been continuously visible for 150ms. On exit-before-generation, the request is canceled.
- Extend the Rust `scan_directory` command so that archive files encountered during folder walking are **inline-expanded** into virtual entries. Each archive discovered this way creates its own `sources` row (kind=`archive`), its entries are listed/thumbnailed, and those entries appear in the same `ImageBatch` output as the folder's loose images — all using the unified schema from change 1.
- Inline-discovered archives honor the existing password flow: an archive requiring a password is emitted as a **single placeholder entry** (a locked tile) rather than its contents. Clicking the placeholder opens the standard password dialog.
- Add a `PlatformService.requestThumbnail(sourceId, entryPath)` / `cancelThumbnail(...)` API and a subscription method `onThumbnailsReady(callback)` for the async delivery.
- Settings UI: expose the `folderThumbnails` mode toggle with explanatory copy on the cost/benefit (lazy strategy is a progressive enhancement; first view still uses the original).

## Capabilities

### New Capabilities
- `lazy-thumbnail-pipeline`: Viewport-triggered lazy thumbnail generation for folder images — request/cancel protocol, dwell-time gating, deduplication, LIFO queue with concurrency limit, cooperative cancellation, and async delivery via events.
- `mixed-folder-discovery`: Inline expansion of archive files encountered during folder scanning — each archive becomes a virtual source with its own entries merged into the parent folder's batch output.

### Modified Capabilities
- `rust-file-engine`: `scan_directory` handles archive files discovered during traversal (delegates to the scan-archive path); emits a new `images:thumbnails` event for progressive thumbnail delivery; registers a background worker for the thumbnail queue.
- `thumbnail-protocol`: Thumbnails may be populated asynchronously after initial `ImageBatch` emission — frontend SHALL merge incremental updates into the image store without re-rendering the entire grid.
- `waterfall-view`: Grid cells SHALL subscribe (via IntersectionObserver) to viewport presence, request thumbnails with 150ms dwell gating, cancel on exit, and re-render when their entry's `thumbnails` array is populated.
- `settings-panel`: New `folderThumbnails` mode selector with an "off"/"lazy" toggle.
- `image-http-server`: Document that `/thumb` may 404 during the window between viewport entry and thumbnail ready; frontend SHALL treat 404 as "not ready yet, fall back to original" rather than as an error.

## Impact

- **Rust backend**: New dedicated thumbnail worker loop (tokio task) with a priority queue (e.g., `std::collections::BTreeMap` keyed by request timestamp, or an explicit `VecDeque` used LIFO). Extends `thumbnail_service` with generation + cancellation. Adds `walkdir` branches in `scan_directory` for archive-inline expansion (partially implemented in change 1's schema; activated here).
- **Tauri commands**: Adds `request_thumbnail`, `cancel_thumbnail`. `scan_directory` now emits additional events.
- **Events**: New `images:thumbnails` event with payload `{ sourceId, entryPath, thumbnails: Thumbnail[] }`.
- **PlatformService (core)**: Three new methods: `requestThumbnail`, `cancelThumbnail`, `onThumbnailsReady`. Store receives incremental updates.
- **State management**: `viewerStore` / `appStore` gain a thumbnail-merge action that patches an `ImageEntry` by `(sourceId, entryPath)` key.
- **Frontend components**: `WaterfallGrid` tile wraps each cell in an `IntersectionObserver` + dwell-timer hook. Coordination utility (`useThumbnailRequest`) lives in `packages/core/src/hooks/`.
- **Settings**: New `folderThumbnails: "off" | "lazy"` flag; default `"off"` so existing users see no change.
- **i18n**: New keys for the settings toggle and the "locked archive" placeholder label.
- **Performance caveat (explicit)**: Lazy thumbnails are a subsequent-view optimization — they are generated *after* the original has already been downloaded once. Document this in the settings UI.
