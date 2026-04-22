## ADDED Requirements

### Requirement: Thumbnail serving endpoint
The HTTP server SHALL expose a `GET /thumb?archive=<archive-hash>&entry=<entry-hash>` endpoint that serves cached thumbnail WebP files.

#### Scenario: Valid thumbnail request
- **WHEN** a GET request is made to `/thumb?archive=abc123&entry=def456` and the thumbnail exists
- **THEN** the server SHALL respond with HTTP 200, the WebP file contents, and `Content-Type: image/webp`

#### Scenario: Thumbnail not found
- **WHEN** a GET request is made for a thumbnail that does not exist in cache
- **THEN** the server SHALL respond with HTTP 404

### Requirement: Extracted image serving
The HTTP server SHALL serve full-size images extracted from archives using the existing `/image` endpoint. The `path` parameter SHALL accept paths within the cache extraction directory.

#### Scenario: Serve extracted archive image
- **WHEN** a full image has been extracted to `<cache-dir>/extracted/abc123/photo.jpg` and a request is made with that path
- **THEN** the server SHALL serve the file with the correct Content-Type

## MODIFIED Requirements

### Requirement: Directory-scoped access control
The server SHALL maintain a set of allowed root directories. Only files whose canonicalized path falls under one of these allowed roots SHALL be served. The allowed roots SHALL be updated each time `scan_directory` is invoked with new directory paths. The cache directory SHALL be implicitly included as an allowed root.

#### Scenario: File within allowed directory
- **WHEN** `/photos/` is an allowed root and a request is made for `/photos/vacation/beach.jpg`
- **THEN** the server SHALL serve the file

#### Scenario: File outside allowed directory
- **WHEN** `/photos/` is the only allowed root and a request is made for `/etc/passwd`
- **THEN** the server SHALL respond with HTTP 403

#### Scenario: Path traversal attempt
- **WHEN** a request is made with a path containing `../` segments that resolve outside allowed roots
- **THEN** the server SHALL canonicalize the path and respond with HTTP 403

#### Scenario: Allowed roots updated on scan
- **WHEN** `scan_directory` is invoked with paths `["/new-folder/"]`
- **THEN** `/new-folder/` SHALL be added to the allowed roots and files within it SHALL be servable

#### Scenario: Cache directory always allowed
- **WHEN** a request is made for a file within the thumbnail/extraction cache directory
- **THEN** the server SHALL serve the file without requiring explicit root registration
