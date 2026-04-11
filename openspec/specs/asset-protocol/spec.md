## ADDED Requirements

### Requirement: Asset protocol for local file serving
The application MAY retain Tauri's `asset://` protocol configuration for non-image file access (e.g., app assets). However, image rendering in the webview SHALL use the embedded HTTP server (`http://localhost:<port>/image?path=...`) instead of `asset://localhost/<encoded-path>` URLs. The `TauriPlatformService.getImageUrl()` method SHALL return localhost HTTP URLs, not asset protocol URLs.

#### Scenario: Image rendered via HTTP server
- **WHEN** an image `<img>` element is rendered in the grid or viewer
- **THEN** the `src` attribute SHALL be an `http://localhost:<port>/image?path=<encoded-path>` URL
- **AND** the image SHALL render correctly using the browser's native HTTP loading pipeline

### Requirement: Persisted scope across sessions
The application SHALL use `tauri-plugin-persisted-scope` to remember filesystem access permissions across app restarts, so users do not need to re-select folders after restarting.

#### Scenario: Permission persistence
- **WHEN** a user selects a folder and then restarts the application
- **THEN** the previously selected folder SHALL still be accessible via the asset protocol without re-selection

### Requirement: Path encoding
File paths containing special characters (spaces, unicode, etc.) SHALL be properly encoded in asset protocol URLs.

#### Scenario: Path with spaces
- **WHEN** an image exists at `/my photos/vacation pic.jpg`
- **THEN** the HTTP URL SHALL properly encode the path via `encodeURIComponent` and the image SHALL render correctly
