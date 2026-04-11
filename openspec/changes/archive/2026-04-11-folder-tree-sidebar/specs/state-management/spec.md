## ADDED Requirements

### Requirement: Directory tree state
The app store SHALL manage directory tree navigation state: the list of directory paths, the currently selected folder, expanded tree nodes, and per-folder image counts.

#### Scenario: Tree state initialized on scan
- **WHEN** a folder scan begins and `listDirectoryTree` returns results
- **THEN** the app store SHALL populate `directoryTree` with the returned directory paths
- **AND** `selectedFolder` SHALL be null (showing all images)
- **AND** `folderImageCounts` SHALL be an empty map

#### Scenario: Folder selected
- **WHEN** the user clicks a folder in the sidebar
- **THEN** `selectedFolder` SHALL update to that folder's relative path

#### Scenario: Folder deselected
- **WHEN** the user clicks the root node or "Show All"
- **THEN** `selectedFolder` SHALL be set to null

#### Scenario: Image counts updated incrementally
- **WHEN** a new batch of images arrives during scanning
- **THEN** `folderImageCounts` SHALL be updated by incrementing counts for each image's parent directory and all ancestor directories

#### Scenario: State reset on new scan
- **WHEN** the user selects a new root folder to scan
- **THEN** all directory tree state SHALL be reset (tree cleared, selection cleared, counts cleared)
