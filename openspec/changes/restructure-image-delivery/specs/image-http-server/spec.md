## MODIFIED Requirements

### Requirement: Image file endpoint
The server SHALL expose a `GET /image?path=<encoded-uri>` endpoint that ALWAYS serves original image bytes. The `path` query parameter SHALL be a `encodeURIComponent`-encoded value containing either (a) a bare absolute filesystem path, (b) a `file://` URI, or (c) an `archive:///` URI. When `path` identifies an archive entry, the handler SHALL delegate to the Rust archive service to resolve the original — returning a cached extracted file if present, or extracting on demand when the cache misses. The endpoint SHALL NEVER return thumbnails, regardless of URI scheme.

#### Scenario: Valid filesystem path request
- **WHEN** a GET request is made to `/image?path=%2Fphotos%2Fcat.jpg` and the file exists and is within an allowed directory
- **THEN** the server SHALL respond with HTTP 200, the file contents as the body, and the correct `Content-Type` header based on file extension

#### Scenario: Archive URI returns original, not thumbnail
- **WHEN** a GET request is made to `/image?path=archive%3A%2F%2F%2FD%3A%2Fpack.zip%23a.jpg` and the entry's original has been cached at `<cache-dir>/extracted/<source-hash>/<entry-hash>.jpg`
- **THEN** the server SHALL respond with HTTP 200 and the original image bytes (not the 400px thumbnail)

#### Scenario: Archive URI triggers on-demand extraction on cache miss
- **WHEN** a GET request is made to `/image?path=archive%3A%2F%2F%2F...` and no cached extracted file exists
- **THEN** the server SHALL extract the entry, persist to cache (subject to `cachePolicy`), and respond with HTTP 200 and the extracted bytes

#### Scenario: Concurrent requests for same archive entry
- **WHEN** two concurrent GET requests are made to `/image?path=archive%3A%2F%2F%2F...` for the same entry on a cache miss
- **THEN** the server SHALL extract the entry exactly once (coordinated by a per-entry async lock) and both requests SHALL receive the same extracted bytes

#### Scenario: Missing path parameter
- **WHEN** a GET request is made to `/image` without a `path` query parameter
- **THEN** the server SHALL respond with HTTP 400

#### Scenario: File not found
- **WHEN** a GET request is made with a `path` pointing to a nonexistent file or archive entry
- **THEN** the server SHALL respond with HTTP 404

## ADDED Requirements

### Requirement: Thumbnail endpoint
The server SHALL expose a `GET /thumb?source=<source-hash>&entry=<entry-hash>&w=<width>` endpoint that serves cached thumbnail images. The handler SHALL look up the thumbnail file at `<cache-dir>/thumbs/<source-hash>/<entry-hash>_<width>.webp` (via the database row if present, or by deterministic path construction) and stream its bytes. The endpoint SHALL NEVER trigger thumbnail generation — thumbnails are produced by the scan pipeline and written ahead of serving.

#### Scenario: Valid thumbnail request
- **WHEN** a GET request is made to `/thumb?source=a7f3c&entry=b2e89&w=400` and the file exists at `<cache-dir>/thumbs/a7f3c/b2e89_400.webp`
- **THEN** the server SHALL respond with HTTP 200, the WebP bytes, and `Content-Type: image/webp`

#### Scenario: Missing query parameter
- **WHEN** a GET request to `/thumb` lacks `source`, `entry`, or `w`
- **THEN** the server SHALL respond with HTTP 400

#### Scenario: Thumbnail not found
- **WHEN** a GET request is made to `/thumb?source=a7f3c&entry=b2e89&w=400` and no file exists at the expected path
- **THEN** the server SHALL respond with HTTP 404
- **AND** the server SHALL NOT attempt to generate or populate the cache

### Requirement: Server has access to shared Rust service layer
The Axum server's `AppState` SHALL hold `Arc` references to the shared Rust services (archive service, thumbnail service, image service) and their dependencies (database handle, password cache, per-entry extract locks). Tauri managed state and Axum `AppState` SHALL share the same `Arc` instances so that updates (e.g., password cache writes) are immediately visible to HTTP handlers.

#### Scenario: Password cache shared between Tauri and Axum
- **WHEN** a user unlocks an archive via the `unlock_archive` Tauri command and then opens an entry via the Axum `/image` endpoint
- **THEN** the extraction in the HTTP handler SHALL use the password just stored, without any re-prompt or explicit plumbing

#### Scenario: Extract lock map lives in AppState
- **WHEN** `/image` is invoked for an archive entry
- **THEN** the handler SHALL acquire a per-entry lock from `AppState.extract_locks` before extracting, and SHALL release it after the response is produced
