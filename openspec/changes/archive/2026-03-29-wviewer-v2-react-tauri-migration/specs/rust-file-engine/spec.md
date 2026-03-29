## ADDED Requirements

### Requirement: Recursive directory traversal
The Rust backend SHALL provide a Tauri command `scan_directory` that accepts one or more directory paths, supported image formats, a page size, and a sort method. It SHALL recursively traverse all directories and subdirectories.

#### Scenario: Single directory scan
- **WHEN** `scan_directory` is invoked with a single directory path and image formats `[".jpg", ".png", ".webp"]`
- **THEN** the backend SHALL recursively find all files matching those extensions in the directory and its subdirectories

#### Scenario: Multiple directory scan
- **WHEN** `scan_directory` is invoked with an array of directory paths
- **THEN** the backend SHALL traverse all provided directories and their subdirectories

### Requirement: Image metadata extraction
The Rust backend SHALL extract image dimensions (width and height) from each discovered image file using header-only reads (not full image decode).

#### Scenario: Image dimensions returned
- **WHEN** a supported image file is discovered during traversal
- **THEN** its width and height in pixels SHALL be included in the result data

#### Scenario: Corrupt image handling
- **WHEN** an image file's dimensions cannot be read (corrupt or unsupported header)
- **THEN** the file SHALL still be included in results with width and height set to null, and no error SHALL be raised to the frontend

### Requirement: Sorting support
The backend SHALL support four sort methods: `name-asc`, `name-desc`, `time-asc`, `time-desc`. Name sorting SHALL use natural sort order. Time sorting SHALL use file modification time.

#### Scenario: Natural name sort ascending
- **WHEN** sort method is `name-asc` and files include `img1.jpg`, `img2.jpg`, `img10.jpg`
- **THEN** results SHALL be ordered `img1.jpg`, `img2.jpg`, `img10.jpg` (not lexicographic `img1, img10, img2`)

#### Scenario: Time sort descending
- **WHEN** sort method is `time-desc`
- **THEN** results SHALL be ordered by file modification time, newest first

### Requirement: Streaming batch emission
The backend SHALL emit image batches to the frontend via Tauri events as they are discovered, rather than waiting for the full scan to complete. Each batch SHALL contain up to `page_size` images.

#### Scenario: Progressive loading
- **WHEN** a directory with 500 images is scanned with `page_size: 50`
- **THEN** the backend SHALL emit approximately 10 `images:batch` events, each containing up to 50 images, as traversal progresses

#### Scenario: Scan completion signal
- **WHEN** directory traversal is complete
- **THEN** a final `images:batch` event SHALL be emitted with `done: true`

### Requirement: Delete file to trash
The Rust backend SHALL provide a Tauri command `delete_to_trash` that moves a file to the system trash/recycle bin.

#### Scenario: Successful delete
- **WHEN** `delete_to_trash` is invoked with a valid file path
- **THEN** the file SHALL be moved to the system trash and the command SHALL return success

#### Scenario: File not found
- **WHEN** `delete_to_trash` is invoked with a nonexistent file path
- **THEN** the command SHALL return an error indicating the file was not found

### Requirement: Image data structure
Each image record emitted by the backend SHALL include: `source` (original file path), `src` (asset protocol URL), `width` (pixels or null), `height` (pixels or null).

#### Scenario: Data structure format
- **WHEN** an image file at `/photos/cat.jpg` with dimensions 1920x1080 is discovered
- **THEN** the emitted record SHALL contain `source: "/photos/cat.jpg"`, `src: "asset://localhost/..."` (encoded path), `width: 1920`, `height: 1080`
