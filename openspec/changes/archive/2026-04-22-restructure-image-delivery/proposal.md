## Why

The archive-browsing implementation conflated two distinct concerns under a single `archive://` URI: **identification** of an archive entry and **selection** of thumbnail-vs-original. As a result, `GET /image?path=archive:///...` always returns the 400px cached thumbnail, and the image viewer — which calls `getImageUrl()` just like the masonry grid — silently shows thumbnails instead of originals. The separate `extractArchiveEntry` Tauri command returns a raw disk path that the frontend cannot feed into `<img src>`, so nothing calls it. The pipeline is broken end-to-end.

Fixing this well requires more than a local patch. Thumbnails should be treated as a first-class delivery mode for **any** source (folders or archives), the Axum server should own all extraction and serving (not the frontend), and cache lifecycle must be configurable per-source with separate thumbnail and extracted-original stores. This change establishes that foundation.

## What Changes

- **BREAKING**: Reshape `ImageBatch` / `ImageEntry` — `source` now carries only the original URI; a new optional `thumbnails: Thumbnail[]` field carries multi-resolution thumbnail descriptors (width-descriptor `srcset` semantics).
- **BREAKING**: Split `PlatformService.getImageUrl(source)` (always returns original URL) from a new `getThumbUrl(thumbId)` (resolves a thumbnail id to a URL). The masonry renders a single `<img>` with dynamically injected `src`, `srcSet`, `width`, `height` based on what the batch provides.
- **BREAKING**: Remove `extractArchiveEntry` from `PlatformService` and its Tauri command. Extraction becomes an implicit side effect of `GET /image?path=archive:///...` on the Axum server.
- **BREAKING**: Axum `/image` endpoint no longer returns thumbnails for `archive://` URIs. It serves originals (extracting on demand via the Rust service layer when the extracted cache misses). Thumbnails are served exclusively via `GET /thumb?...`.
- Introduce a new `mg-thumb://` URI scheme for thumbnail identifiers: `mg-thumb:///<sourceHash>/<entryHash>?w=<width>`. Frontend `getThumbUrl` parses it into the `/thumb?...` endpoint URL.
- Refactor Rust backend into a service layer (`archive_service`, `thumbnail_service`, `image_service`) shared by both Tauri commands and Axum handlers. `server.rs` becomes a thin HTTP transport.
- **BREAKING**: Replace the `archives` + `thumbnails` SQLite schema with a unified `sources` + `thumbnails` + `extracted` schema. `sources.kind` is `"archive" | "folder"`. Folder identity is its absolute path; migration detection uses the last path segment (the "filename" equivalent). Existing cache is cleared on first launch (the archive cache feature has not yet shipped; no user migration needed).
- Split cache directories: `cache/thumbs/` (cheap, long-lived) and `cache/extracted/` (expensive, aggressively managed). Provide independent clear APIs for each.
- Add configurable cache policy (application-level defaults + per-source override):
  - Extracted-cache mode: `no-cache` (re-extract every access) | `lru-capped` (per-source size cap) | `unlimited`
  - Minimum file size threshold: files below this size skip extraction caching entirely
  - Thumbnail retention: `until-source-removed` | `lru-capped`
- Fix the viewer-shows-thumbnail bug as a natural consequence of the split: viewer calls `getImageUrl(source)` → `/image?path=archive:///...` → service extracts on demand → returns original bytes.
- Prepare `sources` table for `kind="folder"` rows (schema ready) but do not yet generate folder thumbnails — that lands in a follow-up change.
- Settings panel: new "Cache" section for policy configuration and separate clear-thumbs / clear-extracted actions.

## Capabilities

### New Capabilities
- `sources-cache`: Unified cache management for archive and folder sources — SQLite `sources`/`thumbnails`/`extracted` schema, per-source policy override, split cache directories, independent clearing.
- `thumbnail-protocol`: The `mg-thumb://` URI scheme and its resolution to HTTP URLs by `getThumbUrl`; multi-resolution `srcset` semantics on the frontend.

### Modified Capabilities
- `image-http-server`: `/image` endpoint now serves originals for `archive://` URIs (extracting on demand); new `/thumb` endpoint semantics; server state gains access to the shared Rust service layer.
- `asset-protocol`: `TauriPlatformService` interface split — `getImageUrl` returns original URLs only; new `getThumbUrl` returns thumbnail URLs; `extractArchiveEntry` removed.
- `rust-file-engine`: Replace `extract_archive_entry` Tauri command with a Rust-side `archive_service`; rename/retire `scan_archive`'s thumbnail generation to go through `thumbnail_service`; `ImageBatch` output shape changes to include `thumbnails[]`.
- `waterfall-view`: Grid renders a single `<img>` with dynamic `src`/`srcSet`/`sizes`/`width`/`height` injection instead of a single `src` call.
- `image-viewer`: Viewer calls `getImageUrl(source)` and always receives the original (previously silently returned thumbnails for archive entries).
- `settings-panel`: New cache-policy subsection; separate thumb/extracted clear actions.

## Impact

- **Rust backend**: New `archive_service.rs`, `thumbnail_service.rs`, `image_service.rs` modules. `server.rs` reduced to routing. `database.rs` schema rewritten. `archive_commands.rs` slimmed (delegates to services; loses `extract_archive_entry`). `lib.rs` wires services into both Tauri managed state and Axum `AppState`.
- **Tauri commands**: Removed `extract_archive_entry`. `scan_archive` output shape changes. New commands `clear_thumbnails`, `clear_extracted` (replacing single `clear_cache`).
- **PlatformService (core)**: `getImageUrl` signature unchanged in shape but semantics clarified (original only). New `getThumbUrl(thumbId): string`. `extractArchiveEntry` removed. `ImageBatch` type gains `thumbnails?: Thumbnail[]` on entries.
- **Frontend components**: `WaterfallGrid.tsx` rewritten to use dynamic attribute injection. `ImageViewer.tsx` unchanged behaviorally (continues using `getImageUrl`) but now correctly renders originals.
- **Web adapter**: `WebPlatformService` gets a no-op `getThumbUrl` that returns an empty string or throws — web platform has no thumbnails.
- **Settings**: New `cachePolicy` setting tree. Old archive-only settings (`cacheCleanupStrategy`) absorbed into new structure or removed if redundant.
- **Concurrency**: Axum-owned extraction requires per-entry locking (avoid duplicate extraction on concurrent requests) — adds a `DashMap` or similar to `AppState`.
- **Testing surface**: Service layer becomes the unit-testable boundary; HTTP handlers become integration tests.
