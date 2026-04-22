## ADDED Requirements

### Requirement: Unified sources table
The Rust backend SHALL persist archive and folder cache metadata in a single `sources` table with a `kind` column restricted to `'archive'` or `'folder'`. Each source SHALL have a unique `origin_path` (the absolute path of the archive file or folder root) and an `identity_segment` column containing the last path segment of `origin_path` (the filename for archives, the directory name for folders), indexed alongside `size_hint` to support migration-candidate lookups.

#### Scenario: Archive source row
- **WHEN** a user opens `D:/packs/vacation.zip` for the first time
- **THEN** the backend SHALL insert a row into `sources` with `kind='archive'`, `origin_path='D:/packs/vacation.zip'`, `identity_segment='vacation.zip'`, `size_hint=<archive file size>`, and `content_hash=hash(path+size+mtime)`

#### Scenario: Folder source row
- **WHEN** a user opens the folder `D:/photos/2026/`
- **THEN** the backend SHALL insert a row into `sources` with `kind='folder'`, `origin_path='D:/photos/2026/'`, `identity_segment='2026'`, `size_hint=NULL`, and `content_hash=hash(origin_path)`

#### Scenario: Uniqueness by origin path
- **WHEN** `scan_archive` or `scan_directory` is invoked twice with the same origin path
- **THEN** the second invocation SHALL find the existing source row (by `origin_path` UNIQUE constraint) and reuse it, updating `last_accessed`

### Requirement: Separate thumbnail and extracted cache tables
The Rust backend SHALL maintain two cache tables — `thumbnails` (one row per source + entry + width) and `extracted` (one row per source + entry). Each SHALL reference `sources.id` with `ON DELETE CASCADE`. `thumbnails` SHALL be UNIQUE on `(source_id, entry_path, width)` to allow multiple widths per entry. `extracted` SHALL be UNIQUE on `(source_id, entry_path)`.

#### Scenario: Multi-resolution thumbnails stored
- **WHEN** a source is configured with `thumbnailSizes: [400, 800, 1600]` and an entry's thumbnails are generated
- **THEN** three rows SHALL exist in `thumbnails` with widths 400, 800, 1600, each referencing the same `source_id` and `entry_path`

#### Scenario: Cascading delete when source removed
- **WHEN** a source row is deleted from the `sources` table
- **THEN** all matching `thumbnails` and `extracted` rows SHALL be deleted automatically

### Requirement: Split cache directories
The Rust backend SHALL use separate on-disk directories for thumbnail and extracted caches, both rooted under the app's data directory. Thumbnails SHALL live at `<cache-dir>/thumbs/<source-hash>/<entry-hash>_<width>.webp`. Extracted originals SHALL live at `<cache-dir>/extracted/<source-hash>/<entry-hash>.<ext>`. `source-hash` SHALL be the `content_hash` stored in the `sources` table; `entry-hash` SHALL be a deterministic hash of the entry path.

#### Scenario: Thumbnail written to split directory
- **WHEN** the thumbnail pipeline generates a 400px thumbnail for entry `folder/photo.jpg` of a source with `content_hash="a7f3c"`
- **THEN** the file SHALL be written to `<cache-dir>/thumbs/a7f3c/<entry-hash>_400.webp`

#### Scenario: Extracted file written to split directory
- **WHEN** the axum `/image` handler extracts `folder/photo.jpg` from an archive on a cache miss
- **THEN** the extracted file SHALL be written to `<cache-dir>/extracted/a7f3c/<entry-hash>.jpg`

### Requirement: Configurable cache policy
The application SHALL expose a `cachePolicy` user setting with the following structure: (1) `extracted.mode` ∈ `{"no-cache", "lru-capped", "unlimited"}`, (2) `extracted.maxSizePerSource` (bytes, required when mode is `"lru-capped"`), (3) `extracted.minFileSize` (bytes; entries smaller than this SHALL not be persisted to the extracted cache even when mode allows caching), (4) `thumbnails.retain` ∈ `{"until-source-removed", "lru-capped"}`, (5) `thumbnails.maxTotalSize` (bytes, required when retain is `"lru-capped"`). The policy SHALL persist via `tauri-plugin-store`.

#### Scenario: No-cache mode re-extracts on every access
- **WHEN** `cachePolicy.extracted.mode` is `"no-cache"` and the user opens the same archive entry in the viewer twice
- **THEN** the backend SHALL extract the entry to a request-scoped tempfile each time and SHALL NOT write to the `extracted` table

#### Scenario: LRU eviction when cap exceeded
- **WHEN** a source's `extracted_cache_size` exceeds `extracted.maxSizePerSource` after a new extraction
- **THEN** the backend SHALL evict extracted rows (and their files) in ascending `last_accessed` order until usage is below the cap

#### Scenario: Small-file threshold skips caching
- **WHEN** `cachePolicy.extracted.minFileSize` is 20 MB and the user opens a 2 MB archive entry
- **THEN** the backend SHALL extract to serve the HTTP response but SHALL NOT insert a row into `extracted` or leave the file on disk after the response completes

### Requirement: Per-source policy override
Each row in the `sources` table SHALL have a nullable `policy_override` column storing a JSON blob with the same structure as `CachePolicy` (all fields optional). When extracting or thumbnailing, the effective policy SHALL be computed by deep-merging `policy_override` onto the application-level `cachePolicy`.

#### Scenario: Override narrows a single source
- **WHEN** the application policy has `extracted.mode="unlimited"` and a specific archive's `policy_override` is `{"extracted":{"mode":"no-cache"}}`
- **THEN** that archive SHALL be extracted on-demand without persistence while all other archives SHALL use unlimited caching

#### Scenario: No override uses application default
- **WHEN** a source has `policy_override=NULL`
- **THEN** the effective policy SHALL be the application-level `cachePolicy` unchanged

### Requirement: Independent cache clearing
The Rust backend SHALL expose two Tauri commands for cache clearing: `clear_thumbnails(sourceId?: number)` and `clear_extracted(sourceId?: number)`. Each SHALL delete only the files and database rows associated with its cache type. When `sourceId` is omitted, the command SHALL clear the specified cache type across all sources.

#### Scenario: Clear extracted keeps thumbnails
- **WHEN** `clear_extracted` is invoked with a specific source id
- **THEN** the backend SHALL delete the `<cache-dir>/extracted/<source-hash>/` directory and the matching `extracted` rows
- **AND** the source's thumbnails and `thumbnails` rows SHALL remain intact

#### Scenario: Clear all thumbnails across sources
- **WHEN** `clear_thumbnails` is invoked without a source id
- **THEN** the backend SHALL delete `<cache-dir>/thumbs/` recursively and truncate the `thumbnails` table

### Requirement: Migration candidate detection by identity segment
When opening a source whose `origin_path` has no exact match in the `sources` table, the Rust backend SHALL search for migration candidates by matching `identity_segment` (and `size_hint` for archives). For folders, `size_hint` is NULL and SHALL NOT be part of the filter. The backend SHALL then perform reverse path-segment comparison against candidates and surface the best match (if any) via `check_migration`.

#### Scenario: Archive filename-based candidate search
- **WHEN** the user opens `E:/new-loc/pack.zip` (900 MB) and the `sources` table contains an archive row with `identity_segment='pack.zip'`, `size_hint=900000000`, and `origin_path='D:/old-loc/pack.zip'`
- **THEN** the backend SHALL return this row as a migration candidate with a score equal to the count of matching reversed path segments

#### Scenario: Folder name-based candidate search
- **WHEN** the user opens `E:/backup/collection/` and a folder row exists with `identity_segment='collection'` and `origin_path='D:/photos/collection/'`
- **THEN** the backend SHALL return it as a migration candidate using the same reverse path-segment scoring

#### Scenario: No candidates found
- **WHEN** no row in `sources` matches both `identity_segment` and (for archives) `size_hint`
- **THEN** `check_migration` SHALL return `null` and the source SHALL be treated as new

### Requirement: First-launch cache wipe
On the first launch after upgrading from a schema without the unified `sources` table (i.e., the `archive-browsing` pre-release schema), the Rust backend SHALL detect the legacy schema, close the connection, delete the entire `<cache-dir>` directory, and recreate the database with the new schema. This SHALL NOT prompt the user; a single info-level log entry SHALL be emitted.

#### Scenario: Upgrade wipes legacy cache
- **WHEN** the application launches and finds an `archives` table (legacy schema) in `cache.db`
- **THEN** the backend SHALL remove `<cache-dir>/` (including `cache.db`) and initialize the new schema on a fresh directory

#### Scenario: Fresh install creates new schema
- **WHEN** the application launches and no `cache.db` exists
- **THEN** the backend SHALL create the new schema directly without any wipe step
