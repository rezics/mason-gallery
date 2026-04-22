## Context

After change 1 (`restructure-image-delivery`), the codebase has:
- A `sources` table with both `archive` and `folder` kinds wired up, but only archive sources produce thumbnails.
- `thumbnail_service` that knows how to generate thumbnails for archive entries (invoked by `scan_archive`).
- Axum `/thumb` endpoint that serves cached thumbnails but never generates on-demand.
- `ImageEntry` with an optional `thumbnails` array; waterfall grid's single `<img>` render path handles both "has thumbs" and "no thumbs" uniformly.

This change activates folder thumbnails and merges archive handling into `scan_directory`. The principal design challenge is **when to generate**. Eager generation on scan is wasteful (a 10 000-image folder would queue 10 000 tasks before the user sees the first screen). Generating on every `IntersectionObserver` fire is also bad (fast scroll past 10 000 images enqueues 10 000 tasks). The right answer is a dwell-gated, cancelable, LIFO-prioritized queue with concurrency limits — essentially an asynchronous work-stealing scheduler that respects user attention.

## Goals / Non-Goals

**Goals:**
- Provide an optional, zero-friction upgrade path for folder users: flip a toggle → subsequent grid revisits are faster.
- Keep thumbnail generation proportional to actual user attention (visible + dwelled).
- Merge mixed-folder archive discovery into the existing scan flow so users don't have to "open" archives inside folders separately.
- Preserve existing behavior exactly when `folderThumbnails: "off"` — zero side effects, no new events, no extra DB writes.
- Make the queue robust to fast scrolls, repeated viewport entries, and explicit cancels.

**Non-Goals:**
- Pre-generating thumbnails eagerly at scan time. Reserved for a future opt-in "Prewarm" feature.
- Streaming thumbnail generation with visible progress bars per tile. A lightweight indicator (dim placeholder or fade-in) suffices.
- Detecting image-file modifications to invalidate thumbnails. Folder thumbnails are invalidated only when the user explicitly clears them or deletes the source.
- Supporting nested archives inside inline-discovered archives.
- Supporting password-protected archives fully inline — a locked archive produces a placeholder tile; unlocking requires the existing dialog flow.
- Web platform folder thumbnails. Web lacks the Rust side entirely.

## Decisions

### 1. Viewport trigger with dwell gating

**Decision**: Each grid tile mounts an `IntersectionObserver`. On `isIntersecting=true`, start a `setTimeout(150ms)`; when it fires, call `platform.requestThumbnail(sourceId, entryPath)`. On `isIntersecting=false`, clear the pending timeout (if any) OR call `platform.cancelThumbnail(sourceId, entryPath)` (if the request was already issued).

```
enter viewport ─► [dwelling 0..150ms]
                     │
           ┌─────────┴─────────┐
           │                   │
      exit before           after 150ms
       150ms                      │
           │                      ▼
           ▼               requestThumbnail()
       no-op                      │
                                  ├─► exit later → cancelThumbnail()
                                  │
                                  └─► thumbnails delivered → store merge → re-render
```

**Rationale**: Prevents "fast scroll" from queueing tens of thousands of requests. 150ms is a common dwell threshold used in prefetch/lazy-load libraries — long enough to mean "user paused," short enough that intentional viewing doesn't feel laggy.

**Alternatives considered:**
- Time-weighted scoring (pixels-visible × duration) — more accurate but overkill for this use case.
- Always-on (no dwell) with backend throttling only — still burns frontend request overhead on fast scroll.

### 2. LIFO priority queue + concurrency semaphore

**Decision**: The Rust thumbnail worker uses a LIFO queue with a `tokio::sync::Semaphore(4)` for concurrency limiting. Deduplication: a `HashMap<(source_id, entry_path), QueueSlot>` prevents duplicate enqueues.

```rust
struct QueueSlot {
    enqueued_at: Instant,
    cancel: Arc<AtomicBool>,
    // position: back-reference into VecDeque (or use index on removal)
}

struct ThumbnailQueue {
    pending: Mutex<VecDeque<Key>>,       // LIFO: push_back, pop_back
    active: Mutex<HashMap<Key, Arc<QueueSlot>>>,
    semaphore: Arc<Semaphore>,           // permits: 4
    notify: Arc<Notify>,
}
```

LIFO rationale: the most recently requested tile is the one the user is likely still looking at. FIFO would process whichever tile was scrolled past first — probably already off-screen by the time we get to it.

**Alternatives considered:**
- FIFO — rejected for above reason.
- Priority based on distance-from-viewport-center — not worth the complexity; LIFO is a good approximation.

### 3. Cooperative cancellation via `AtomicBool`

**Decision**: Each queued task has an `Arc<AtomicBool>` cancel flag. The worker checks the flag (a) before dequeuing, (b) before starting generation, (c) between resize and save steps. `cancel_thumbnail` sets the flag and, if still in `pending`, removes the entry from the queue immediately.

**Rationale**: Tokio task cancellation at await points is awkward here because `image` crate operations are sync and long-running. Explicit cooperative checks at sync boundaries are cleaner.

**Worker loop sketch:**

```rust
async fn run(self) {
    loop {
        let key = match self.pop_lifo().await { Some(k) => k, None => { self.notify.notified().await; continue; } };
        let slot = match self.active.lock().await.get(&key).cloned() { Some(s) => s, None => continue };
        if slot.cancel.load(Ordering::Acquire) { continue; }
        let _permit = self.semaphore.acquire().await.unwrap();
        if slot.cancel.load(Ordering::Acquire) { continue; }
        let thumbs = tokio::task::spawn_blocking(move || generate(slot, ...)).await?;
        // slot.cancel checked inside generate() too, between steps
        if !slot.cancel.load(Ordering::Acquire) {
            emit_event(app, key, thumbs);
        }
        self.active.lock().await.remove(&key);
    }
}
```

### 4. Inline archive expansion in `scan_directory`

**Decision**: When `walkdir` encounters a file whose extension is in the archive list (`.zip`, `.rar`, `.7z`, `.cbz`, `.cbr`), `scan_directory` branches:

```
walk produces   /D:/photos/pack.zip
     │
     ▼
scan_directory:
  ├─ Register/upsert a source row for the archive (kind='archive')
  ├─ Check if password-protected:
  │    ├─ Yes + no password known → emit ONE placeholder entry for the archive
  │    │  (source = "archive:///D:/photos/pack.zip", relativePath = "pack.zip [locked]",
  │    │   special flag: locked=true, no thumbnails)
  │    │
  │    └─ No or password known →
  │       list entries → for each entry, emit an image entry identical to what
  │       scan_archive would emit (source = archive:/// URI, optional thumbnails
  │       depending on cache hits)
  │
  └─ continue walking
```

Archive thumbnails inside a mixed-folder scan are generated the same way as standalone archive scans: eagerly during scan (existing behavior from change 1) or from cache if already present.

**Password-protected placeholder**: Rendered as a dimmed tile with a lock icon. Click → opens the standard password dialog → on success, the placeholder is replaced by triggering a fresh `scan_archive` for that archive.

**Rationale**: Users have uniform expectations across loose and archived content. Two-step discovery (first see archive, then open) is friction without benefit when the archive is unencrypted.

**Alternatives considered:**
- Emit archives as "virtual folder" tiles (same as early archive-browsing proposal) — rejected; adds navigation complexity; users want the images, not the container.
- Scan archives in a second pass after loose images — rejected; breaks the streaming UX (users see half the folder, wait, see rest).

### 5. Asynchronous thumbnail delivery via events

**Decision**: A new Tauri event `images:thumbnails` carries incremental updates:

```typescript
interface ThumbnailsReadyEvent {
  sourceId: number;
  entryPath: string;
  thumbnails: Thumbnail[];
}
```

The frontend store (`appStore` or a dedicated `imageStore`) subscribes once at app boot. On event, it finds the matching `ImageEntry` by `(sourceId, entryPath)` and patches `thumbnails` — triggering a re-render of only that tile.

**Rationale**: Symmetrical with the existing `images:batch` / `images:count` event pattern. Decouples generation latency from initial scan latency.

**Alternative**: Poll from the frontend — rejected; unnecessary request overhead and staleness.

### 6. Reuse `cachePolicy.extracted.minFileSize` as the thumbnail-generation threshold

**Decision**: Files smaller than `cachePolicy.extracted.minFileSize` SHALL skip thumbnail generation entirely. (For folder thumbnails the cost calculus mirrors extracted caching: tiny files are cheap to serve directly, so the thumbnail adds bytes without saving bytes.)

**Rationale**: Avoids introducing another threshold. The semantics of "only bother with caching for files above N bytes" is identical in spirit across both forms.

**Alternative**: Separate `cachePolicy.thumbnails.minFileSize` — rejected as unnecessary complexity; can be added if real usage diverges.

### 7. Stable keys for the dedup set

**Decision**: Dedup key is `(source_id, entry_path)` — both integers/strings already present in `ImageEntry`. The frontend coordinator maintains a `Set<string>` of `"<sourceId>:<entryPath>"` to avoid duplicate requests for the same tile (e.g., when it scrolls in and out and back in repeatedly).

Backend uses the same key shape as its `HashMap` key.

### 8. Locked archive UX

**Decision**: A locked archive placeholder is an `ImageEntry` with:
- `source` = the `archive:///` URI of the archive file itself (no entry fragment)
- `relativePath` = the archive's relative path + `" [locked]"` suffix
- `width` = `height` = `null`
- `thumbnails` = absent
- A new optional field `locked: true` tells the grid to render the lock-icon tile

Clicking opens a dialog (existing password dialog, possibly restyled).

**Rationale**: Keeps the data shape uniform (one entry type flowing through the grid). The `locked` flag is the only new field.

### 9. Settings default remains `"off"`

**Decision**: `folderThumbnails: "off"` by default. Users must opt in.

**Rationale**: Zero disruption for existing users. Many collections work fine with original-direct serving. Thumbnails are a disk/CPU cost; opt-in is the right default.

## Risks / Trade-offs

- **[Lazy thumbnails provide zero first-view benefit]** → First render already downloads the original; the thumbnail only helps subsequent views. Mitigation: document this clearly in the settings toggle's helper text. Users who want first-view benefit need a future eager-prewarm mode (out of scope here).

- **[Queue with thousands of entries has memory overhead]** → Each `QueueSlot` holds a few pointers; 10 000 queued = negligible. Mitigation: monitor and cap queue length in practice if needed; for now, no cap.

- **[Race between cancel and completion]** → Worker may finish just as cancel arrives. Mitigation: final cancel check *before emitting event*. A completed-but-canceled thumbnail still writes to the cache (no harm — just wasted work on a task that's done anyway). Event is suppressed so the frontend doesn't re-render a tile the user scrolled past.

- **[`images:thumbnails` event flood on rapid dwell churn]** → User rapidly scrolls and pauses at each tile; many events fire. Mitigation: frontend store batches updates into a single React state transition per animation frame (`unstable_batchedUpdates` or similar).

- **[Inline archive expansion blocks folder scan on archive scan latency]** → A folder containing a 50 GB RAR will hold up the folder's `images:batch` emission while we list the archive. Mitigation: accept for v1; in a follow-up, emit folder loose images first, then archives in a second streaming phase.

- **[Locked archive placeholder tile inconsistency]** → If the user unlocks mid-scan, the placeholder lives in the grid with no obvious refresh. Mitigation: on successful unlock, frontend re-runs `scan_archive` for that specific archive and merges entries into the store, replacing the placeholder.

- **[Folder thumbnail cache grows without an explicit source identity]** → A folder's `content_hash` is derived from path alone, so renaming/moving the folder produces a new source row (and orphans the old cache). Mitigation: existing migration detection (identity_segment + reverse path comparison) handles this symmetrically for folders (change 1).

## Migration Plan

1. No schema changes — change 1 already laid the groundwork.
2. Ship with `folderThumbnails: "off"` default. Users with no preference see identical behavior to change 1.
3. Users who enable lazy thumbnails begin populating the folder thumbnail cache gradually as they browse. No upfront cost.
4. If a user disables lazy thumbnails later, the existing cache rows SHALL remain (harmless; the frontend simply stops emitting `thumbnails` arrays, so they go unused). A dedicated "Clear folder thumbnails" button can purge them (reuses `clear_thumbnails` with a filter by `sources.kind='folder'`).

## Open Questions

- Whether to bake an overall queue-length cap and drop oldest entries. Skip for v1; revisit if real usage hits memory concerns.
- The exact UX copy for the "locked archive" tile and the settings toggle — defer to implementation with i18n review.
- Whether `IntersectionObserver` dwell behavior should be configurable (e.g., slider for 0–500ms). Probably overkill; 150ms is a sensible default.
