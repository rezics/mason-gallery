## ADDED Requirements

### Requirement: Viewport-triggered generation with dwell gating
The frontend SHALL request thumbnail generation for a grid tile only after that tile has been continuously visible in the viewport for at least 150 milliseconds. Visibility SHALL be detected via `IntersectionObserver`. If a tile exits the viewport before the 150ms dwell completes, no request SHALL be issued. If a tile exits after the request was issued but before thumbnails arrive, the frontend SHALL cancel the request.

#### Scenario: Fast-scroll past produces no requests
- **WHEN** the user scrolls continuously such that each tile is visible for less than 150ms
- **THEN** no `requestThumbnail` call SHALL be made for those tiles

#### Scenario: Paused dwell triggers request
- **WHEN** a tile becomes visible and remains continuously visible for ≥ 150ms
- **THEN** the frontend SHALL call `platform.requestThumbnail(sourceId, entryPath)` exactly once for that tile

#### Scenario: Exit during dwell clears pending timeout
- **WHEN** a tile becomes visible, then exits after 100ms of dwell
- **THEN** the scheduled 150ms timeout SHALL be cleared and no request SHALL be issued

#### Scenario: Exit after request issues cancel
- **WHEN** a tile's thumbnail has been requested (dwell satisfied) but the tile exits the viewport before thumbnails arrive
- **THEN** the frontend SHALL call `platform.cancelThumbnail(sourceId, entryPath)` for that tile

### Requirement: Frontend deduplication
The frontend SHALL track outstanding thumbnail requests by `(sourceId, entryPath)` key. Re-entering a tile's viewport while a request is already in flight SHALL NOT issue a duplicate request. Re-entry AFTER thumbnails have been delivered SHALL NOT re-request (the tile already has thumbs).

#### Scenario: Duplicate request suppressed
- **WHEN** a tile enters the viewport, dwells, triggers a request, exits, then re-enters before thumbnails arrive
- **THEN** only one `requestThumbnail` call SHALL be made

#### Scenario: Post-delivery re-entry skipped
- **WHEN** a tile's thumbnails have already been delivered and the tile re-enters the viewport
- **THEN** no new `requestThumbnail` call SHALL be made

### Requirement: Backend LIFO queue with concurrency limit
The Rust thumbnail worker SHALL process queued requests in last-in-first-out order, with at most 4 concurrent generations (enforced by a `tokio::sync::Semaphore` with 4 permits). Completed or canceled tasks SHALL release their permits so new tasks can proceed.

#### Scenario: Most recent request runs first
- **WHEN** the queue contains pending requests for entries A, B, C, D, E (enqueued in that order) with no active tasks
- **THEN** the worker SHALL start processing E, D, C, B, A in that order (up to the concurrency limit)

#### Scenario: Concurrency capped at 4
- **WHEN** 20 requests are queued simultaneously with no active tasks
- **THEN** at most 4 SHALL be generating at any moment

### Requirement: Backend deduplication
The Rust thumbnail worker SHALL de-duplicate requests by `(source_id, entry_path)`. Re-enqueue of an already-pending or in-flight request SHALL NOT produce a duplicate task; it MAY update the request's position in the queue (move to top of LIFO).

#### Scenario: Repeated enqueue single task
- **WHEN** `request_thumbnail(7, "a.jpg")` is invoked three times in rapid succession
- **THEN** exactly one task SHALL execute for that key

### Requirement: Cooperative cancellation
Each queued request SHALL have an associated `Arc<AtomicBool>` cancel flag. The worker SHALL check the flag before dequeuing, before acquiring a semaphore permit, and between generation steps (decode, resize, encode). `cancel_thumbnail` SHALL set the flag and, if the request is still in the pending queue, remove it immediately. Generation already in flight SHALL abort at the next check without finishing.

#### Scenario: Pending request canceled immediately
- **WHEN** `cancel_thumbnail(7, "a.jpg")` is invoked while the request is still in the pending queue
- **THEN** the request SHALL be removed from the queue and no generation task SHALL start for it

#### Scenario: In-flight generation aborts cooperatively
- **WHEN** `cancel_thumbnail(7, "a.jpg")` is invoked while generation is partway through resizing
- **THEN** the next check of the cancel flag SHALL abort the task before saving to disk
- **AND** no `images:thumbnails` event SHALL be emitted for that key

### Requirement: Asynchronous thumbnail delivery via `images:thumbnails` event
The Rust backend SHALL emit an `images:thumbnails` event per completed generation. The event payload SHALL be `{ sourceId: number, entryPath: string, thumbnails: Thumbnail[] }`. The frontend SHALL subscribe to this event once at boot and SHALL patch the matching entry in the image store by `(sourceId, entryPath)`, triggering a re-render of only that tile.

#### Scenario: Event emitted on success
- **WHEN** thumbnail generation completes successfully for `(sourceId=7, entryPath="a.jpg")` at widths [400, 800]
- **THEN** the backend SHALL emit `images:thumbnails` with `{ sourceId: 7, entryPath: "a.jpg", thumbnails: [{ source: "mg-thumb:///...?w=400", width: 400, height: ... }, { ...w=800... }] }`

#### Scenario: Store merges incremental update
- **WHEN** the frontend receives an `images:thumbnails` event matching an existing entry
- **THEN** that entry's `thumbnails` field SHALL be set in-place in the store
- **AND** only the affected grid tile SHALL re-render (not the whole grid)

#### Scenario: No event on cancellation
- **WHEN** generation is canceled via `cancel_thumbnail`
- **THEN** no `images:thumbnails` event SHALL be emitted for that key

### Requirement: Minimum file-size threshold
Folder thumbnail generation SHALL honor `cachePolicy.extracted.minFileSize`. Files smaller than this threshold SHALL NOT be thumbnailed — the frontend SHALL continue serving the original for these tiles. The backend SHALL return a success response from `request_thumbnail` with `skipped: true` so the frontend can mark the entry as "no thumbnails will arrive" and stop waiting.

#### Scenario: Small file skipped
- **WHEN** `request_thumbnail` is invoked for a file smaller than `cachePolicy.extracted.minFileSize`
- **THEN** the backend SHALL NOT enqueue a task
- **AND** the frontend SHALL be notified (return value or event) that no thumbnails will arrive for that entry

#### Scenario: Threshold reused from extracted cache policy
- **WHEN** `cachePolicy.extracted.minFileSize` is set to 20 MB
- **THEN** the same 20 MB threshold SHALL gate folder thumbnail generation
