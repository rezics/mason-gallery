## MODIFIED Requirements

### Requirement: Asset protocol for local file serving
The application MAY retain Tauri's `asset://` protocol configuration for non-image file access (e.g., app assets). Image rendering in the webview SHALL use the embedded HTTP server for both originals (`http://127.0.0.1:<port>/image?path=...`) and thumbnails (`http://127.0.0.1:<port>/thumb?source=...&entry=...&w=...`). The `PlatformService` interface SHALL provide two distinct methods: `getImageUrl(source)` — which ALWAYS resolves to an original-image HTTP URL — and `getThumbUrl(thumbId)` — which resolves an `mg-thumb://` URI to a thumbnail HTTP URL.

#### Scenario: Image viewer renders original via HTTP server
- **WHEN** the image viewer opens an archive entry with `source="archive:///D:/pack.zip#a.jpg"`
- **THEN** the viewer SHALL call `platform.getImageUrl(source)` and receive an `http://127.0.0.1:<port>/image?path=<encoded>` URL that serves the ORIGINAL (not the thumbnail)

#### Scenario: Waterfall grid renders thumbnails via HTTP server
- **WHEN** a grid cell renders an entry whose `thumbnails` array contains `mg-thumb://` URIs
- **THEN** the cell SHALL call `platform.getThumbUrl(thumb.source)` for each thumbnail and produce an `http://127.0.0.1:<port>/thumb?...` URL

#### Scenario: Grid renders original when no thumbnails present
- **WHEN** a grid cell renders an entry with `thumbnails` absent or empty
- **THEN** the cell SHALL fall back to `platform.getImageUrl(entry.source)` with no `srcSet` — using the original for display

## ADDED Requirements

### Requirement: `getImageUrl` returns originals only
The `PlatformService.getImageUrl(source: string)` method SHALL return a URL that — when loaded by the browser — yields the original image bytes. It SHALL NOT return thumbnail URLs under any URI scheme. Callers that need a thumbnail SHALL use `getThumbUrl` instead.

#### Scenario: Archive URI returns original URL
- **WHEN** `getImageUrl("archive:///D:/pack.zip#a.jpg")` is called on the desktop platform
- **THEN** the returned URL SHALL resolve to the full-resolution image when fetched — never to the 400px thumbnail

#### Scenario: Filesystem path returns original URL
- **WHEN** `getImageUrl("D:/photos/a.jpg")` is called on the desktop platform
- **THEN** the returned URL SHALL resolve to the original file contents

## REMOVED Requirements

### Requirement: Extract archive entry method on PlatformService
**Reason**: The method returned a raw filesystem path, which the webview cannot load. No frontend code ever called it. Extraction is now an implicit server-side side effect of requesting an archive entry via `getImageUrl` → `/image` endpoint, coordinated by the Rust archive service.

**Migration**: Remove all code paths that call `platform.extractArchiveEntry(...)`. Replace with `platform.getImageUrl(source)` where `source` is the `archive://` URI — the HTTP response bytes are the extracted original.
