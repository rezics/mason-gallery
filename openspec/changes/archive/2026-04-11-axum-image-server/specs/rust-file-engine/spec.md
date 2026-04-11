## MODIFIED Requirements

### Requirement: Image data structure
Each image record emitted by the backend SHALL include: `source` (the original absolute file path), `width` (pixels or null), `height` (pixels or null). The `source` field SHALL contain the raw filesystem path. The frontend adapter SHALL be responsible for constructing the display URL from the path using the image server port.

#### Scenario: Data structure format
- **WHEN** an image file at `/photos/cat.jpg` with dimensions 1920x1080 is discovered
- **THEN** the emitted record SHALL contain `source: "/photos/cat.jpg"`, `width: 1920`, `height: 1080`
- **AND** the frontend adapter SHALL construct the display URL as `http://localhost:<port>/image?path=%2Fphotos%2Fcat.jpg`

### Requirement: Allowed directories registration
The `scan_directory` command SHALL register its input directory paths with the image HTTP server's allowed-roots set before beginning file traversal, so that images are servable as soon as batches are emitted to the frontend.

#### Scenario: Directories registered before batch emission
- **WHEN** `scan_directory` is invoked with paths `["/photos", "/wallpapers"]`
- **THEN** both `/photos` and `/wallpapers` SHALL be added to the server's allowed roots before any `images:batch` event is emitted
