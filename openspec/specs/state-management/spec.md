## ADDED Requirements

### Requirement: Settings store
The application SHALL maintain a Zustand store (`useSettingsStore`) for all user-configurable settings. This store SHALL sync bidirectionally with tauri-plugin-store on every change.

#### Scenario: Setting change persists
- **WHEN** a setting value changes in the Zustand store
- **THEN** the new value SHALL be written to tauri-plugin-store immediately

#### Scenario: Settings loaded on startup
- **WHEN** the application launches
- **THEN** the Zustand store SHALL be hydrated from tauri-plugin-store values

### Requirement: Viewer store
The application SHALL maintain a Zustand store (`useViewerStore`) for runtime viewer state: the current image list, current image index, viewer open/closed state, scan progress, and total image count. The total count SHALL be available before all image metadata has been loaded.

#### Scenario: Image batch appended
- **WHEN** an `images:batch` event arrives from the backend
- **THEN** the images SHALL be appended to the viewer store's image list

#### Scenario: Total count received
- **WHEN** an `images:count` event arrives from the backend with `{ total: 12847 }`
- **THEN** the viewer store SHALL set `totalCount` to 12847
- **AND** the UI SHALL be able to display determinate progress using `images.length / totalCount`

#### Scenario: Viewer state reset
- **WHEN** the user resets the folder selection
- **THEN** the viewer store SHALL clear the image list, reset `totalCount` to 0, and reset all state

### Requirement: App store
The application SHALL maintain a Zustand store (`useAppStore`) for application-level state: selected folder paths, UI flags (settings panel open, etc.).

#### Scenario: Folder paths tracked
- **WHEN** the user selects folders via dialog or drag-and-drop
- **THEN** the selected folder paths SHALL be stored in the app store

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
