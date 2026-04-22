## ADDED Requirements

### Requirement: Recursive directory traversal
The Rust backend SHALL provide a Tauri command `scan_directory` that accepts one or more directory paths, supported image formats, a page size, and a sort method. It SHALL recursively traverse all directories and subdirectories. When an archive file (`.zip`, `.rar`, `.7z`) is encountered during traversal, it SHALL be included in results as a special entry with a `type: "archive"` marker instead of image dimensions.

#### Scenario: Single directory scan
- **WHEN** `scan_directory` is invoked with a single directory path and image formats `[".jpg", ".png", ".webp"]`
- **THEN** the backend SHALL recursively find all files matching those extensions in the directory and its subdirectories

#### Scenario: Multiple directory scan
- **WHEN** `scan_directory` is invoked with an array of directory paths
- **THEN** the backend SHALL traverse all provided directories and their subdirectories

#### Scenario: Archive file discovered during scan
- **WHEN** a `.zip`, `.rar`, or `.7z` file is encountered during directory traversal
- **THEN** the file SHALL be included in the batch as a special entry with `source` set to the archive path and dimensions set to null, with additional metadata indicating it is an archive

### Requirement: Image metadata extraction
The Rust backend SHALL extract image dimensions (width and height) from each discovered image file using header-only reads (not full image decode).

#### Scenario: Image dimensions returned
- **WHEN** a supported image file is discovered during traversal
- **THEN** its width and height in pixels SHALL be included in the result data

#### Scenario: Corrupt image handling
- **WHEN** an image file's dimensions cannot be read (corrupt or unsupported header)
- **THEN** the file SHALL still be included in results with width and height set to null, and no error SHALL be raised to the frontend

### Requirement: Sorting support
The backend SHALL support four sort methods: `name-asc`, `name-desc`, `time-asc`, `time-desc`. Name sorting SHALL use natural sort order. Time sorting SHALL use file modification time.

#### Scenario: Natural name sort ascending
- **WHEN** sort method is `name-asc` and files include `img1.jpg`, `img2.jpg`, `img10.jpg`
- **THEN** results SHALL be ordered `img1.jpg`, `img2.jpg`, `img10.jpg` (not lexicographic `img1, img10, img2`)

#### Scenario: Time sort descending
- **WHEN** sort method is `time-desc`
- **THEN** results SHALL be ordered by file modification time, newest first

### Requirement: Streaming batch emission
The backend SHALL emit image data to the frontend in two phases via Tauri events. First, an `images:count` event SHALL be emitted after directory traversal and sorting complete, containing the total number of matched files. Then, `images:batch` events SHALL be emitted as dimension extraction proceeds, each containing up to `page_size` images. This ensures the frontend knows the total count before any image metadata arrives.

#### Scenario: Two-phase emission
- **WHEN** a directory with 500 images is scanned with `page_size: 50`
- **THEN** the backend SHALL first emit one `images:count` event with `{ total: 500 }`
- **AND** then emit approximately 10 `images:batch` events, each containing up to 50 images

#### Scenario: Scan completion signal
- **WHEN** directory traversal is complete
- **THEN** a final `images:batch` event SHALL be emitted with `done: true`

### Requirement: List directory tree command
The Rust backend SHALL provide a Tauri command `list_directory_tree` that accepts one or more root directory paths and returns a flat list of all subdirectory paths relative to each root, without scanning files.

#### Scenario: Retrieve directory tree
- **WHEN** `list_directory_tree` is invoked with root path `/Users/me/Photos`
- **THEN** the command SHALL return all subdirectory paths relative to the root (e.g., `["2024", "2024/January", "2024/February"]`)
- **AND** the command SHALL not read or process any files

#### Scenario: Multiple roots
- **WHEN** `list_directory_tree` is invoked with multiple root paths
- **THEN** the command SHALL return directories from all roots, with each path prefixed by its root folder name to avoid collisions

#### Scenario: Performance
- **WHEN** a directory tree with 5,000 subdirectories is queried
- **THEN** the command SHALL return results within 500ms

### Requirement: Delete file to trash
The Rust backend SHALL provide a Tauri command `delete_to_trash` that moves a file to the system trash/recycle bin.

#### Scenario: Successful delete
- **WHEN** `delete_to_trash` is invoked with a valid file path
- **THEN** the file SHALL be moved to the system trash and the command SHALL return success

#### Scenario: File not found
- **WHEN** `delete_to_trash` is invoked with a nonexistent file path
- **THEN** the command SHALL return an error indicating the file was not found

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

### Requirement: Allowed directories registration
The `scan_directory` command SHALL register its input directory paths with the image HTTP server's allowed-roots set before beginning file traversal, so that images are servable as soon as batches are emitted to the frontend.

#### Scenario: Directories registered before batch emission
- **WHEN** `scan_directory` is invoked with paths `["/photos", "/wallpapers"]`
- **THEN** both `/photos` and `/wallpapers` SHALL be added to the server's allowed roots before any `images:batch` event is emitted

### Requirement: Scan archive command
The Rust backend SHALL provide a Tauri command `scan_archive` that accepts an archive file path, image formats, page size, sort method, and an optional password. It SHALL read the archive's file index, filter for image entries, generate/retrieve cached thumbnails, and emit results as `images:batch` events — identical in shape to `scan_directory` output.

#### Scenario: Scan a ZIP archive
- **WHEN** `scan_archive` is invoked with a ZIP file path and formats `[jpg, png, webp]`
- **THEN** the backend SHALL list all matching image entries, generate thumbnails for uncached entries, and emit `images:count` followed by `images:batch` events

#### Scenario: Scan with cached thumbnails
- **WHEN** `scan_archive` is invoked for a previously scanned archive with a valid cache
- **THEN** the backend SHALL emit batches using cached thumbnail data without re-extracting from the archive

#### Scenario: Password required
- **WHEN** `scan_archive` is invoked on an encrypted archive without a password
- **THEN** the backend SHALL return a `PasswordRequired` error

### Requirement: Get archive info command
The Rust backend SHALL provide a Tauri command `get_archive_info` that returns metadata about an archive: format, entry count, total uncompressed size, is_solid, is_encrypted.

#### Scenario: Query archive metadata
- **WHEN** `get_archive_info` is invoked with an archive path
- **THEN** the backend SHALL return the archive's metadata without extracting any entries

### Requirement: Cache management commands
The Rust backend SHALL provide Tauri commands for cache operations: `get_cache_stats` (list all cached archives with sizes), `clear_cache` (delete cache for one or all archives), and `pin_cache` (toggle pin status).

#### Scenario: Get cache statistics
- **WHEN** `get_cache_stats` is invoked
- **THEN** the backend SHALL query SQLite and return a list of cached archives with their sizes, entry counts, pin status, and last accessed dates

#### Scenario: Clear specific archive cache
- **WHEN** `clear_cache` is invoked with an archive hash
- **THEN** the backend SHALL delete that archive's thumbnails and extracted files from disk and remove its SQLite records

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
