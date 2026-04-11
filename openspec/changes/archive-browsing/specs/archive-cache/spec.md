## ADDED Requirements

### Requirement: SQLite cache database
The application SHALL maintain a SQLite database (`cache.db`) in the app data directory for storing archive thumbnail metadata, cache statistics, and password entries.

#### Scenario: Database created on first use
- **WHEN** the application opens an archive for the first time and no `cache.db` exists
- **THEN** the database SHALL be created with the required schema (archives, thumbnails, passwords tables)

#### Scenario: Database survives restart
- **WHEN** the application restarts
- **THEN** all previously cached thumbnail metadata SHALL be available

### Requirement: Thumbnail generation
The application SHALL generate WebP thumbnails (max 400px on the longest side) for each image entry in an archive. Thumbnails SHALL be stored on disk at `<cache-dir>/thumbs/<archive-hash>/<entry-hash>.webp`.

#### Scenario: Generate thumbnail for archive entry
- **WHEN** an uncached image entry is encountered during archive scanning
- **THEN** the system SHALL extract the image, resize it to fit within 400px, encode as WebP, save to disk, and record the path and dimensions in SQLite

#### Scenario: Cache hit on subsequent open
- **WHEN** a previously cached archive is opened again (same path + size + mtime hash)
- **THEN** the system SHALL serve thumbnails from cache without re-extracting from the archive

#### Scenario: Parallel thumbnail generation
- **WHEN** an archive with many uncached entries is scanned
- **THEN** thumbnail generation SHALL run in parallel across available CPU cores

### Requirement: Cache invalidation
The cache SHALL detect when an archive file has been modified or moved since it was cached, using a hash of (file path + file size + modification time).

#### Scenario: Archive modified after caching
- **WHEN** a cached archive's file size or modification time has changed
- **THEN** the old cache SHALL be purged and thumbnails regenerated

#### Scenario: Archive file deleted
- **WHEN** a cached archive no longer exists at its original path
- **THEN** the cache entry SHALL be marked as orphaned and eligible for cleanup

### Requirement: Cache cleanup strategies
The application SHALL support two configurable cache cleanup strategies:

1. **Auto-clean** (default): On application startup, delete all cached data for non-pinned archives
2. **Keep all**: Never auto-delete; user manages cache manually

#### Scenario: Auto-clean on startup
- **WHEN** the app starts with "auto-clean" strategy and archives A (pinned) and B (unpinned) are cached
- **THEN** cache for archive B SHALL be deleted; cache for archive A SHALL be preserved

#### Scenario: Keep all mode
- **WHEN** the app starts with "keep all" strategy
- **THEN** no cache SHALL be automatically deleted

### Requirement: Cache pinning
Users SHALL be able to pin specific archive caches to prevent them from being auto-cleaned. Pinning status SHALL be stored in the SQLite database.

#### Scenario: Pin an archive cache
- **WHEN** the user pins archive `pack-A.zip` in the cache management UI
- **THEN** that archive's cache SHALL survive auto-clean cycles

#### Scenario: Unpin an archive cache
- **WHEN** the user unpins a previously pinned archive
- **THEN** that archive's cache SHALL be eligible for auto-clean

### Requirement: Cache management page
The application SHALL provide a `/cache` route with a management UI showing all cached archives. Each entry SHALL display: archive file name/path, thumbnail count, cache size on disk, last accessed date, and pin status.

#### Scenario: View cache list
- **WHEN** the user navigates to `/cache`
- **THEN** all cached archives SHALL be listed with their metadata

#### Scenario: Delete single archive cache
- **WHEN** the user clicks the delete button on an archive entry
- **THEN** that archive's thumbnails and extracted files SHALL be deleted from disk and its SQLite records removed

#### Scenario: Bulk clear unpinned
- **WHEN** the user clicks "Clear unpinned"
- **THEN** all non-pinned archive caches SHALL be deleted

#### Scenario: Bulk clear all
- **WHEN** the user clicks "Clear all"
- **THEN** all archive caches SHALL be deleted, including pinned ones

#### Scenario: Total cache size displayed
- **WHEN** the cache management page loads
- **THEN** the total disk usage across all caches SHALL be displayed

### Requirement: On-demand full image extraction
When the user views a full-size image from an archive, the system SHALL extract the original image to `<cache-dir>/extracted/<archive-hash>/` and serve it via the HTTP server.

#### Scenario: Open full image from archive
- **WHEN** the user opens the image viewer for an archive entry
- **THEN** the full-resolution image SHALL be extracted and displayed

#### Scenario: Already extracted
- **WHEN** the full image was previously extracted and still exists in cache
- **THEN** the cached extracted file SHALL be served without re-extraction

### Requirement: Solid archive warning
When the user opens a solid archive, the application SHALL display a warning dialog explaining that browsing will require extracting the entire solid block, potentially consuming significant cache space.

#### Scenario: Solid archive detected
- **WHEN** a solid archive is opened for the first time
- **THEN** a dialog SHALL appear: "This archive uses solid compression. Browsing will create a large cache (estimated size: X). We recommend extracting the archive to a folder for better performance. Continue anyway?"

#### Scenario: User cancels
- **WHEN** the user clicks "Cancel" on the solid archive warning
- **THEN** the archive SHALL not be opened and no cache SHALL be created

#### Scenario: User proceeds
- **WHEN** the user clicks "Continue" on the solid archive warning
- **THEN** the system SHALL proceed with extraction and caching
