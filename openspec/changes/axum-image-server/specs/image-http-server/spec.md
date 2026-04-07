## ADDED Requirements

### Requirement: Embedded HTTP server for image serving
The Tauri backend SHALL start an Axum HTTP server bound to `127.0.0.1:0` during app initialization (`tauri::Builder::setup()`). The server SHALL serve local image files over HTTP to the webview. The assigned port SHALL be stored in Tauri managed state.

#### Scenario: Server starts on app launch
- **WHEN** the Tauri application starts
- **THEN** an HTTP server SHALL be listening on `127.0.0.1` on an OS-assigned port
- **AND** the port SHALL be retrievable via the `get_image_server_port` Tauri command

#### Scenario: Server stops on app exit
- **WHEN** the Tauri application exits
- **THEN** the HTTP server SHALL shut down gracefully

### Requirement: Image file endpoint
The server SHALL expose a `GET /image?path=<encoded-absolute-path>` endpoint that serves image files. The `path` query parameter SHALL be a `encodeURIComponent`-encoded absolute filesystem path.

#### Scenario: Valid image request
- **WHEN** a GET request is made to `/image?path=%2Fphotos%2Fcat.jpg` and the file exists and is within an allowed directory
- **THEN** the server SHALL respond with HTTP 200, the file contents as the body, and the correct `Content-Type` header based on file extension

#### Scenario: Missing path parameter
- **WHEN** a GET request is made to `/image` without a `path` query parameter
- **THEN** the server SHALL respond with HTTP 400

#### Scenario: File not found
- **WHEN** a GET request is made with a `path` pointing to a nonexistent file
- **THEN** the server SHALL respond with HTTP 404

### Requirement: Directory-scoped access control
The server SHALL maintain a set of allowed root directories. Only files whose canonicalized path falls under one of these allowed roots SHALL be served. The allowed roots SHALL be updated each time `scan_directory` is invoked with new directory paths.

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

### Requirement: HTTP caching headers
The server SHALL set caching headers on successful image responses to enable browser-level caching.

#### Scenario: Cache headers on 200 response
- **WHEN** an image is served successfully
- **THEN** the response SHALL include `Cache-Control: private, max-age=3600, immutable`
- **AND** an `ETag` header derived from the file path and modification time

#### Scenario: Conditional request with matching ETag
- **WHEN** a request includes an `If-None-Match` header matching the current ETag
- **THEN** the server SHALL respond with HTTP 304 Not Modified and no body

### Requirement: Correct Content-Type mapping
The server SHALL set the `Content-Type` header based on the file extension.

#### Scenario: JPEG file
- **WHEN** a file with extension `.jpg` or `.jpeg` is served
- **THEN** the `Content-Type` SHALL be `image/jpeg`

#### Scenario: PNG file
- **WHEN** a file with extension `.png` is served
- **THEN** the `Content-Type` SHALL be `image/png`

#### Scenario: WebP file
- **WHEN** a file with extension `.webp` is served
- **THEN** the `Content-Type` SHALL be `image/webp`

#### Scenario: GIF file
- **WHEN** a file with extension `.gif` is served
- **THEN** the `Content-Type` SHALL be `image/gif`

#### Scenario: BMP file
- **WHEN** a file with extension `.bmp` is served
- **THEN** the `Content-Type` SHALL be `image/bmp`

### Requirement: Frontend port discovery
The Tauri backend SHALL expose a command `get_image_server_port` that returns the port number the image server is listening on.

#### Scenario: Port retrieval
- **WHEN** the frontend invokes the `get_image_server_port` command
- **THEN** the command SHALL return the port number as a `u16`
