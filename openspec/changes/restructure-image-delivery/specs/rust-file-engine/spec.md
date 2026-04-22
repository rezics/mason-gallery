## ADDED Requirements

### Requirement: Rust service layer
The Rust backend SHALL be organized into discrete service modules — `archive_service`, `thumbnail_service`, `image_service`, `source_service` — that hold business logic independent of transport (Tauri command or Axum handler). Service structs SHALL be constructed once during app setup, wrapped in `Arc`, and shared via both Tauri managed state and Axum `AppState`.

#### Scenario: Service shared between Tauri command and HTTP handler
- **WHEN** a Tauri command and an Axum handler both need to extract an archive entry
- **THEN** both SHALL invoke the same method on the same `Arc<ArchiveService>` instance

#### Scenario: `server.rs` is a thin transport layer
- **WHEN** the Axum `image_handler` receives a request
- **THEN** it SHALL parse the query parameters, invoke `image_service::resolve_original(...)`, and translate the result into an HTTP response — without reading/writing SQLite, disk, or archive files directly

### Requirement: Unified cache clearing commands
The Rust backend SHALL expose two Tauri commands — `clear_thumbnails(sourceId?: number)` and `clear_extracted(sourceId?: number)` — that delete the respective cache type independently. The omission of `sourceId` SHALL clear the specified cache across all sources.

#### Scenario: Clear extracted for one source
- **WHEN** `clear_extracted` is invoked with `sourceId=7`
- **THEN** the backend SHALL remove `<cache-dir>/extracted/<source-7-hash>/` recursively and delete rows in `extracted` matching `source_id=7`
- **AND** the backend SHALL NOT modify thumbnails on disk or in the database

#### Scenario: Clear all thumbnails
- **WHEN** `clear_thumbnails` is invoked without a source id
- **THEN** the backend SHALL remove `<cache-dir>/thumbs/` recursively and truncate the `thumbnails` table
- **AND** `sources.thumb_cache_size` SHALL be reset to 0 for all rows

## MODIFIED Requirements

### Requirement: Image data structure
Each image record emitted by the backend SHALL include: `source` (the original URI — `archive:///...` for archive entries, a filesystem path for folder entries), `width` (pixels or null), `height` (pixels or null), `relativePath` (path relative to the source root using forward slashes), and optionally `thumbnails` (an array of `{ source: string, width: number, height: number }` describing multi-resolution thumbnails). The `source` field SHALL always refer to the ORIGINAL. The `thumbnails` array — when present — SHALL contain `mg-thumb://` URIs and their pixel dimensions. The frontend SHALL NOT receive a separate precomputed `src` field; URL construction is the `PlatformService` adapter's responsibility.

#### Scenario: Folder entry without thumbnails
- **WHEN** a scan of `D:/photos/` yields `D:/photos/2024/cat.jpg` (1920x1080) and thumbnail generation is disabled
- **THEN** the emitted record SHALL contain `source="D:/photos/2024/cat.jpg"`, `width=1920`, `height=1080`, `relativePath="2024/cat.jpg"`, and no `thumbnails` field (or `thumbnails` empty)

#### Scenario: Archive entry with thumbnails
- **WHEN** a scan of `D:/packs/vacation.zip` yields the entry `folder/photo.jpg` and thumbnails have been generated at widths `[400, 800, 1600]`
- **THEN** the emitted record SHALL contain `source="archive:///D:/packs/vacation.zip#folder/photo.jpg"`, `relativePath="folder/photo.jpg"`, `thumbnails=[{source:"mg-thumb:///...?w=400", width:400, height:<calc>}, {w=800,...}, {w=1600,...}]`

#### Scenario: Root-level image
- **WHEN** an image file is directly in the scanned root directory (not in a subdirectory)
- **THEN** `relativePath` SHALL be just the filename (e.g., `"photo.jpg"`)

## REMOVED Requirements

### Requirement: Extract archive entry command
**Reason**: The `extract_archive_entry` Tauri command returned a raw filesystem path to the frontend, which cannot be used as an `<img src>` in the webview. Extraction now happens transparently inside the Axum `/image` handler via the Rust archive service when an `archive://` URI is requested. No frontend code ever successfully consumed this command.

**Migration**: Remove the `extract_archive_entry` command registration from `lib.rs` and delete the `archive_commands::extract_archive_entry` function. Remove the corresponding `PlatformService.extractArchiveEntry` method. Frontend callers (none today) switch to `platform.getImageUrl(archiveUri)` and let the HTTP layer handle extraction.
