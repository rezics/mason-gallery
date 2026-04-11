## ADDED Requirements

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

### Requirement: Extract archive entry command
The Rust backend SHALL provide a Tauri command `extract_archive_entry` that accepts an `archive://` URI and extracts the referenced entry to the cache directory, returning the local file path.

#### Scenario: Extract single entry
- **WHEN** `extract_archive_entry` is invoked with `archive:///D:/pack.zip#photo.jpg`
- **THEN** the backend SHALL extract `photo.jpg` from `pack.zip` to the cache and return the extracted file path

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

## MODIFIED Requirements

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
