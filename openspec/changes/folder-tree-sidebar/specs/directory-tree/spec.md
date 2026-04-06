## ADDED Requirements

### Requirement: Directory tree retrieval
The application SHALL provide a platform-abstracted method to retrieve the directory tree structure of a scanned root folder, returning a flat list of relative directory paths without scanning image files.

#### Scenario: Desktop directory tree
- **WHEN** `listDirectoryTree` is called with root path `/Users/me/Photos`
- **THEN** the method SHALL return a flat array of relative directory paths (e.g., `["2024", "2024/January", "2024/February", "2023"]`)
- **AND** the method SHALL complete without reading any file contents or metadata

#### Scenario: Web directory tree
- **WHEN** `listDirectoryTree` is called with a `FileSystemDirectoryHandle`
- **THEN** the method SHALL recursively enumerate directory-kind entries and return relative paths
- **AND** file entries SHALL be skipped

#### Scenario: Empty directory
- **WHEN** a scanned root contains no subdirectories
- **THEN** `listDirectoryTree` SHALL return an empty array

#### Scenario: Path separator normalization
- **WHEN** directory paths are retrieved on any platform
- **THEN** all paths SHALL use forward slashes (`/`) as separators, regardless of the OS

### Requirement: Incremental folder image counts
As image batches arrive during scanning, the application SHALL compute and update per-folder image counts by extracting the directory portion from each image's `relativePath`.

#### Scenario: Counts update progressively
- **WHEN** a batch of 50 images arrives, 30 of which have `relativePath` starting with `2024/January/`
- **THEN** the folder count for `2024/January` SHALL increase by 30

#### Scenario: Parent folder counts include children
- **WHEN** `2024/January` contains 30 images and `2024/February` contains 20 images
- **THEN** the displayed count for `2024` SHALL be 50 (sum of all descendants)
