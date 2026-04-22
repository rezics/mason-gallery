## 1. Settings Foundation

- [ ] 1.1 Add `folderThumbnails: "off" | "lazy"` to `Settings` in `@mason-gallery/core/types/platform.ts` (default `"off"`)
- [ ] 1.2 Extend `useSettingsStore` with getter/setter for `folderThumbnails` and persist via platform settings store
- [ ] 1.3 Default the setting to `"off"` in all adapters so existing users see no behavior change

## 2. Rust Thumbnail Worker

- [ ] 2.1 Add module `src-tauri/src/services/thumbnail_queue.rs` with `QueueSlot { enqueued_at: Instant, cancel: Arc<AtomicBool> }` and a `ThumbnailQueue` struct holding `pending: Mutex<VecDeque<Key>>`, `active: Mutex<HashMap<Key, Arc<QueueSlot>>>`, `semaphore: Arc<Semaphore>` (permits=4), `notify: Arc<Notify>`
- [ ] 2.2 Implement `enqueue(key)` — dedupes by key, pushes to back (LIFO pop from back), notifies worker
- [ ] 2.3 Implement `cancel(key)` — sets `cancel` flag, removes from pending if still there
- [ ] 2.4 Spawn a single long-running tokio task in `lib.rs` setup that loops: dequeue LIFO → check cancel → acquire semaphore permit → check cancel → `spawn_blocking(generate)` → check cancel → emit event (or drop if canceled)
- [ ] 2.5 Extend `thumbnail_service` with `generate_for_file(source_id, entry_path, widths[]) -> Vec<ThumbnailDesc>` — reads file bytes, resizes to each width, saves WebP, writes thumbnail rows, returns URIs + dims
- [ ] 2.6 Add cooperative cancel checks inside the generate function between resize steps
- [ ] 2.7 Thread the queue `Arc` into `AppState` so services can enqueue from handlers if needed
- [ ] 2.8 Unit tests: enqueue/cancel/LIFO order; concurrency capped at 4; cancel-in-flight aborts before event emission

## 3. Tauri Commands

- [ ] 3.1 Add command `request_thumbnail(sourceId: i64, entryPath: String) -> ThumbnailRequestResult` where result is `{ enqueued: bool, skipped: bool, reason?: String }`
- [ ] 3.2 `request_thumbnail` pre-checks: if all configured-width thumbnails already exist in the db, return early with `enqueued: false, skipped: false`; if file is below `cachePolicy.extracted.minFileSize`, return `skipped: true`
- [ ] 3.3 Add command `cancel_thumbnail(sourceId: i64, entryPath: String) -> ()` that delegates to `ThumbnailQueue::cancel`
- [ ] 3.4 Register both commands in `lib.rs`
- [ ] 3.5 Integration test: request → event within timeout → payload shape matches spec

## 4. Event Subscription (`images:thumbnails`)

- [ ] 4.1 Define event payload struct `{ source_id: i64, entry_path: String, thumbnails: Vec<ThumbnailDesc> }` in shared types
- [ ] 4.2 Wire the worker to emit `images:thumbnails` via `app.emit` on successful completion only (not on cancel)
- [ ] 4.3 In `TauriPlatformService`, add `onThumbnailsReady(cb)` that calls `listen<ThumbnailsReadyPayload>("images:thumbnails", ...)` and returns an unsubscribe fn
- [ ] 4.4 Stub `onThumbnailsReady` in `WebPlatformService` as a no-op returning a no-op unsubscribe

## 5. PlatformService API

- [ ] 5.1 Add to `PlatformService` interface: `requestThumbnail(sourceId: number, entryPath: string): Promise<{ enqueued: boolean; skipped: boolean }>`, `cancelThumbnail(sourceId: number, entryPath: string): Promise<void>`, `onThumbnailsReady(cb: (e: { sourceId: number; entryPath: string; thumbnails: Thumbnail[] }) => void): () => void`
- [ ] 5.2 Implement these in `TauriPlatformService` via `invoke` + `listen`
- [ ] 5.3 Stub in `WebPlatformService` (no-ops)

## 6. Store Wiring

- [ ] 6.1 Extend the image store with a `patchThumbnails(sourceId, entryPath, thumbnails)` action that finds the entry by `(sourceId, entryPath)` and sets its `thumbnails` field
- [ ] 6.2 Add `sourceId` to each `ImageEntry` (if not already emitted by change 1's scan output) so patching can key off of it
- [ ] 6.3 On app boot, subscribe once via `platform.onThumbnailsReady(...)` and route updates through `patchThumbnails`
- [ ] 6.4 Add a `skippedThumbs: Set<string>` in the store for entries that came back `skipped: true`, keyed by `"<sourceId>:<entryPath>"`, to suppress further requests
- [ ] 6.5 Add a `requestedThumbs: Set<string>` in the store for outstanding requests (dedupe across tiles)

## 7. Frontend Viewport Hook

- [ ] 7.1 Create `packages/core/src/hooks/useThumbnailRequest.ts` that takes `(entry, enabled)` and returns a `ref` to attach to the tile's DOM element
- [ ] 7.2 Hook internals: create an `IntersectionObserver` on mount (disconnect on unmount); on `isIntersecting=true`, set a `setTimeout(150ms)` that calls `requestThumbnail` and tracks state as "requested"; on `isIntersecting=false`, clear pending timeout and — if "requested" — call `cancelThumbnail`
- [ ] 7.3 Guard with `enabled` flag (false when `folderThumbnails !== "lazy"` OR when entry already has thumbs OR when entry is marked skipped OR when entry belongs to an archive source where archive thumbs already covered)
- [ ] 7.4 Dedupe via the store's `requestedThumbs` set — don't issue a fresh request if key already present

## 8. Grid Tile Integration

- [ ] 8.1 In `WaterfallGrid.tsx`, wire `useThumbnailRequest(entry, folderThumbnails === "lazy")` into each tile (attach returned ref to tile wrapper)
- [ ] 8.2 Ensure the grid tile re-renders when its specific entry's `thumbnails` is patched (e.g., via Zustand selector scoped to that entry)
- [ ] 8.3 Verify positioner does NOT recompute on thumbnail patches (aspect ratio remains stable)

## 9. Locked Archive UX

- [ ] 9.1 Extend `ImageEntry` type with optional `locked?: boolean`
- [ ] 9.2 Backend emits `locked: true` placeholder when `scan_directory` encounters an encrypted archive with no known password
- [ ] 9.3 Grid tile renders a lock icon + filename layout for `locked: true` entries (no `<img>`)
- [ ] 9.4 Click handler opens the existing password dialog pre-filled with the archive path
- [ ] 9.5 On successful unlock, invoke `scan_archive` for the archive; store replaces placeholder in-place with emitted entries
- [ ] 9.6 Wrong password retains placeholder; dialog shows retry state

## 10. Mixed Folder Discovery in `scan_directory`

- [ ] 10.1 In `commands::scan_directory`, detect archive extensions during `walkdir` traversal; branch into the archive service path
- [ ] 10.2 For each discovered archive: upsert a `sources` row (kind=`archive`), check password state, either list entries + generate/retrieve thumbnails OR emit placeholder
- [ ] 10.3 Preserve sort order — archive entries emitted at the archive file's position in the parent folder's sorted listing
- [ ] 10.4 Thread archive entries through the existing batch emission loop so they appear in the same `images:batch` stream as loose files
- [ ] 10.5 `images:count` includes both loose-file count and archive-entry count

## 11. Settings Panel UI

- [ ] 11.1 Add the `folderThumbnails` control (MUI ToggleButtonGroup or Select) with `"off" | "lazy"` options
- [ ] 11.2 Include helper text explaining the lazy cost/benefit (first view still uses original; subsequent views benefit)
- [ ] 11.3 Wire through `useSettingsStore` and `platform.saveSettings`
- [ ] 11.4 i18n strings (EN + ZH) for the toggle label, options, and helper text

## 12. Verification & Polish

- [ ] 12.1 Manual test: folder with 5000 loose images, `folderThumbnails=lazy`, fast-scroll top-to-bottom — confirm queue count remains low (few tasks), no memory spikes
- [ ] 12.2 Manual test: folder with 5000 loose images, slow-scroll — confirm thumbnails arrive for dwelled tiles and merge without full grid re-render
- [ ] 12.3 Manual test: mixed folder with 3 archives (1 unencrypted, 1 pre-unlocked, 1 locked) — verify unencrypted inline, pre-unlocked inline, locked shows placeholder; click-unlock replaces placeholder
- [ ] 12.4 Manual test: toggle `folderThumbnails` off mid-session — confirm no new requests issued; cached thumbnails remain on disk
- [ ] 12.5 Manual test: set `minFileSize=20MB` and scroll through a folder of small images — confirm no requests queued, no events emitted
- [ ] 12.6 `bun run check` clean; `cargo check` clean
- [ ] 12.7 `openspec validate lazy-folder-thumbnails-and-inline-archives --strict` clean
- [ ] 12.8 Update `CLAUDE.md` with the lazy-pipeline and mixed-folder notes
