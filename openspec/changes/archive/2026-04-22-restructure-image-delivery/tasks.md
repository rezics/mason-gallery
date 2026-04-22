## 1. Preparation & Cleanup

- [x] 1.1 Wipe any developer-local `archive-cache/` directory to start clean (no production users affected)
- [x] 1.2 Create a new schema version marker (e.g., `CREATE TABLE schema_meta (version INTEGER)`) so future migrations can detect legacy state
- [x] 1.3 Update `CLAUDE.md` architecture section only after all other tasks complete (keep until end to reflect final shape)

## 2. SQLite Schema Rewrite

- [x] 2.1 Rewrite `database.rs` with new schema — drop `archives` + `thumbnails`; create `sources`, `thumbnails`, `extracted`, `passwords`, `schema_meta`
- [x] 2.2 Add `sources(kind CHECK('archive','folder'), origin_path UNIQUE, identity_segment, size_hint, content_hash, is_solid, is_pinned, entry_count, thumb_cache_size, extracted_cache_size, policy_override, last_accessed, created_at)` + index on `(identity_segment, size_hint)`
- [x] 2.3 Add `thumbnails(source_id FK, entry_path, width, height, thumb_path, file_size, UNIQUE(source_id, entry_path, width))`
- [x] 2.4 Add `extracted(source_id FK, entry_path, extract_path, file_size, last_accessed, UNIQUE(source_id, entry_path))`
- [x] 2.5 Implement legacy-schema detection: on startup, if old `archives` table exists, close connection, `remove_dir_all` `<cache-dir>/`, recreate db
- [x] 2.6 Rewrite CRUD helpers in `database.rs`: `upsert_source`, `get_source_by_path`, `find_migration_candidates`, `insert_thumbnail`, `get_thumbnail`, `insert_extracted`, `get_extracted`, `touch_extracted`, `delete_source`, etc.
- [x] 2.7 Add `get_thumbnails_by_entry(source_id, entry_path) -> Vec<ThumbRow>` — returns all widths for one entry
- [x] 2.8 Add unit tests for each DB helper

## 3. Rust Service Layer

- [x] 3.1 Create `src-tauri/src/services/` module directory with `mod.rs` re-exports
- [x] 3.2 Implement `source_service.rs`: open/create sources (archive vs folder branch), migration detection (reverse path-segment scoring), identity-segment computation
- [x] 3.3 Implement `archive_service.rs`: open archive reader (delegates to existing `archive.rs`), list entries, extract entry to disk path, plus `ExtractResult` variants (cached / freshly extracted / tempfile-for-no-cache)
- [x] 3.4 Implement `thumbnail_service.rs`: `resolve(source_hash, entry_hash, width) -> PathBuf` (lookup only, no generation), `generate_for_archive_entry(...)` (used by `scan_archive` pipeline; returns list of `(width, height, path)` per configured thumbnailSize)
- [x] 3.5 Implement `image_service.rs`: `resolve_original(uri, policy) -> ResolvedBytes` — routes `archive:///` via `archive_service`, bare paths / `file://` via direct read with allowed-roots check; enforces `extracted.minFileSize` and `extracted.mode` when caching
- [x] 3.6 Add `ExtractLocks = Arc<DashMap<String, Arc<tokio::sync::Mutex<()>>>>` in services crate; `image_service.resolve_original` acquires per-entry lock around extraction
- [x] 3.7 Add `dashmap` dependency to `Cargo.toml`
- [x] 3.8 Unit tests for each service (use tempdir fixtures for cache dir, embedded sqlite)

## 4. Axum Server Refactor

- [x] 4.1 Rewrite `server.rs` — `AppState` carries `Arc<Database>`, `Arc<PasswordCache>`, `Arc<ExtractLocks>`, `Arc<AllowedRoots>`, `cache_dir`, and (optional) service handles
- [x] 4.2 Modify `image_handler` to ALWAYS return originals; delegate to `image_service::resolve_original`
- [x] 4.3 Remove `serve_archive_thumb` from `server.rs` entirely
- [x] 4.4 Rewrite `thumb_handler` to accept `source`, `entry`, `w` query params; look up via `thumbnail_service::resolve`; return 404 on miss (no generation)
- [x] 4.5 Add content-type detection for `.webp` thumbnails in `serve_file` (already correct — verify)
- [x] 4.6 Ensure ETag computation continues to work on extracted files (use underlying file's metadata)
- [ ] 4.7 Integration test: two concurrent requests for same archive entry trigger exactly one extraction

## 5. Tauri Wiring

- [x] 5.1 Update `lib.rs` setup: construct `Arc<Database>`, `Arc<PasswordCache>`, `Arc<ExtractLocks>`; register via `app.manage(...)`; pass same `Arc`s into `start_server`
- [x] 5.2 Remove `extract_archive_entry` command registration
- [x] 5.3 Rename `clear_cache` command, splitting into `clear_thumbnails(sourceId?)` and `clear_extracted(sourceId?)`
- [x] 5.4 Update `archive_commands.rs`: `scan_archive` emits entries with the new `thumbnails` array shape; delegates thumbnail generation to `thumbnail_service`
- [x] 5.5 Update `check_migration` / `confirm_migration` to operate on `sources` table (not `archives`) and accept both archive and folder paths (folder prep only — folder scan flow comes in change 2)
- [x] 5.6 Update `get_cache_stats` to return unified source stats (both kinds) with `thumb_cache_size` and `extracted_cache_size` separately
- [x] 5.7 Update `pin_cache` to operate on `sources.is_pinned`

## 6. Core Package (TypeScript) Types

- [x] 6.1 In `@mason-gallery/core/types/platform.ts`: add `Thumbnail { source: string; width: number; height: number }` interface
- [x] 6.2 Extend `ImageBatch.images[i]` with optional `thumbnails?: Thumbnail[]`
- [x] 6.3 Add `getThumbUrl(thumbId: string): string` to `PlatformService` interface (required method)
- [x] 6.4 Remove `extractArchiveEntry` from `PlatformService`
- [x] 6.5 Replace `clearCache` with `clearThumbnails(sourceId?: number)` and `clearExtracted(sourceId?: number)` on `PlatformService`
- [x] 6.6 Define `CachePolicy` type (extracted mode/maxSizePerSource/minFileSize + thumbnails retain/maxTotalSize) and `SourceOverride = Partial<CachePolicy>` in types
- [x] 6.7 Add `cachePolicy: CachePolicy` + `thumbnailSizes: number[]` to `Settings`
- [x] 6.8 Update `CacheStats` to include `thumbCacheSize` and `extractedCacheSize` separately; add `kind: "archive" | "folder"` field

## 7. Desktop Adapter (TauriPlatformService)

- [x] 7.1 Implement `getThumbUrl(thumbId)` — parse `mg-thumb:///<sourceHash>/<entryHash>?w=<width>` and return `http://127.0.0.1:<port>/thumb?source=...&entry=...&w=...`
- [x] 7.2 Delete `extractArchiveEntry` method
- [x] 7.3 Rename `clearCache` → split into `clearThumbnails` / `clearExtracted` invoking their respective Tauri commands
- [x] 7.4 Verify `getImageUrl` already returns HTTP URL for any source (no change needed — semantics now correct)

## 8. Web Adapter (WebPlatformService)

- [x] 8.1 Add `getThumbUrl(...)` stub returning empty string
- [x] 8.2 No-op stubs for `clearThumbnails` / `clearExtracted` (web has no cache)

## 9. Waterfall Grid Rendering

- [x] 9.1 Rewrite the `<img>` render in `WaterfallGrid.tsx` to one element with dynamically injected attributes (single branch, no if/else)
- [x] 9.2 Compute `srcSet` from `entry.thumbnails` when non-empty: `thumbs.map(t => \`${platform.getThumbUrl(t.source)} ${t.width}w\`).join(", ")`
- [x] 9.3 Compute a `sizes` attribute from the current grid column width (reuse masonic column width signal if available; otherwise hardcode a reasonable default for now and refine in change 2)
- [x] 9.4 Forward `entry.width` / `entry.height` as `<img width/height>` whenever present (independent of thumbnails)
- [x] 9.5 Verify `loading="lazy"` remains for off-screen tiles

## 10. Image Viewer Fix

- [x] 10.1 Confirm `ImageViewer.tsx` continues to call `platform.getImageUrl(img.source)` — no code change needed
- [ ] 10.2 Manual test: open a password-protected archive, click an entry → viewer SHALL show the original full-resolution image (not the 400px thumbnail)

## 11. Settings Panel UI

- [x] 11.1 Add a "Cache" section with controls for `cachePolicy` (extracted mode dropdown, capped-mode conditional inputs, minFileSize input, thumbnails retention dropdown, maxTotalSize conditional input, thumbnailSizes multi-input)
- [x] 11.2 Wire settings changes through `useSettingsStore` + `platform.saveSettings`
- [x] 11.3 Add "Clear thumbnail cache" and "Clear extracted cache" buttons with MUI confirmation dialogs
- [x] 11.4 Update i18n keys (EN + ZH) for all new strings
- [x] 11.5 Ensure cache-mode UI remains in sync when the user changes mode (conditional inputs hide/show)

## 12. Per-Source Override UI

- [x] 12.1 Extend the existing cache management page (from archive-browsing) to show both archive and folder sources (query unified `sources` table)
- [x] 12.2 For each source row, show effective policy (merged view) and a "Customize" button revealing override controls
- [x] 12.3 Implement override save → JSON-encode and persist via a new Tauri command `set_source_policy(sourceId, override)` (or extend existing)
- [x] 12.4 Implement "Reset to defaults" that nulls the `policy_override` column

## 13. Cleanup & Verification

- [x] 13.1 Grep for all references to removed APIs (`extractArchiveEntry`, old `clear_cache`, `archive_thumbnails`) and purge
- [x] 13.2 Run `bun run check` (biome + tsc) until clean
- [x] 13.3 Run Rust `cargo check` in `src-tauri/` until clean
- [ ] 13.4 Manual test matrix: (a) archive scan → thumbs served, viewer shows originals; (b) concurrent viewer opens → one extraction; (c) `no-cache` mode → no leftover files in `extracted/`; (d) cache clear buttons act independently
- [x] 13.5 Update `CLAUDE.md` architecture section to describe the service layer and split delivery pipelines
- [x] 13.6 Run `openspec validate restructure-image-delivery --strict` and ensure no errors
