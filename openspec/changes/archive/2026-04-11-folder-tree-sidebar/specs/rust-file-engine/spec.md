## ADDED Requirements

### Requirement: List directory tree command
The Rust backend SHALL provide a Tauri command `list_directory_tree` that accepts one or more root directory paths and returns a flat list of all subdirectory paths relative to each root, without scanning files.

#### Scenario: Retrieve directory tree
- **WHEN** `list_directory_tree` is invoked with root path `/Users/me/Photos`
- **THEN** the command SHALL return all subdirectory paths relative to the root (e.g., `["2024", "2024/January", "2024/February"]`)
- **AND** the command SHALL not read or process any files

#### Scenario: Multiple roots
- **WHEN** `list_directory_tree` is invoked with multiple root paths
- **THEN** the command SHALL return directories from all roots, with each path prefixed by its root folder name to avoid collisions

#### Scenario: Performance
- **WHEN** a directory tree with 5,000 subdirectories is queried
- **THEN** the command SHALL return results within 500ms

## MODIFIED Requirements

### Requirement: Image data structure
Each image record emitted by the backend SHALL include: `source` (original file path), `src` (asset protocol URL), `width` (pixels or null), `height` (pixels or null), `relativePath` (path relative to the scanned root directory, using forward slashes).

#### Scenario: Data structure format
- **WHEN** an image file at `/Users/me/Photos/2024/January/cat.jpg` is discovered during a scan rooted at `/Users/me/Photos`
- **THEN** the emitted record SHALL contain `source: "/Users/me/Photos/2024/January/cat.jpg"`, `src: "asset://localhost/..."`, `width: 1920`, `height: 1080`, `relativePath: "2024/January/cat.jpg"`

#### Scenario: Root-level image
- **WHEN** an image file is directly in the scanned root directory (not in a subdirectory)
- **THEN** `relativePath` SHALL be just the filename (e.g., `"photo.jpg"`)
