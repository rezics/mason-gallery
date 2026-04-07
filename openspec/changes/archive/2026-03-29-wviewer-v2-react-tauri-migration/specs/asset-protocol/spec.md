## ADDED Requirements

### Requirement: Asset protocol for local file serving
The application SHALL use Tauri's `asset://` protocol to serve local image and video files to the webview. The `tauri.conf.json` SHALL configure an asset scope that permits access to user-selected directories.

#### Scenario: Image rendered via asset protocol
- **WHEN** an image `<img>` element uses an `asset://localhost/<encoded-path>` URL
- **THEN** the image SHALL render correctly in the webview

### Requirement: Persisted scope across sessions
The application SHALL use `tauri-plugin-persisted-scope` to remember filesystem access permissions across app restarts, so users do not need to re-select folders after restarting.

#### Scenario: Permission persistence
- **WHEN** a user selects a folder and then restarts the application
- **THEN** the previously selected folder SHALL still be accessible via the asset protocol without re-selection

### Requirement: Path encoding
File paths containing special characters (spaces, unicode, etc.) SHALL be properly encoded in asset protocol URLs.

#### Scenario: Path with spaces
- **WHEN** an image exists at `/my photos/vacation pic.jpg`
- **THEN** the asset URL SHALL properly encode the path and the image SHALL render correctly
