## MODIFIED Requirements

### Requirement: Native folder selection dialog
The application SHALL allow users to select one or more folders via a native OS folder picker dialog using `tauri-plugin-dialog`. A separate "Open Archive" action SHALL open a file picker dialog filtered to `.zip`, `.rar`, and `.7z` extensions.

#### Scenario: Select single folder
- **WHEN** the user clicks the folder selection UI element and selects one folder
- **THEN** the application SHALL begin scanning that folder for images

#### Scenario: Select multiple folders
- **WHEN** the user selects multiple folders in the dialog
- **THEN** the application SHALL scan all selected folders

#### Scenario: Open archive file
- **WHEN** the user clicks the "Open Archive" action and selects a `.zip`, `.rar`, or `.7z` file
- **THEN** the application SHALL begin scanning that archive for images

### Requirement: Drag-and-drop folder opening
The application SHALL accept folders and archive files (`.zip`, `.rar`, `.7z`) dragged and dropped onto the application window.

#### Scenario: Drop single folder
- **WHEN** the user drags a folder from the file manager and drops it onto the application window
- **THEN** the application SHALL begin scanning the dropped folder for images

#### Scenario: Drop multiple folders
- **WHEN** the user drops multiple folders onto the application window
- **THEN** the application SHALL scan all dropped folders

#### Scenario: Drop archive file
- **WHEN** the user drags a `.zip`, `.rar`, or `.7z` file and drops it onto the application window
- **THEN** the application SHALL begin scanning that archive for images

#### Scenario: Drop mixed folders and archives
- **WHEN** the user drops a mix of folders and archive files onto the application window
- **THEN** the application SHALL scan folders normally and open archives via the archive reader

### Requirement: Upload/drop zone UI
When no folder is loaded, the application SHALL display a prominent upload/drop zone with instructions. The instructions SHALL mention that both folders and archive files are accepted.

#### Scenario: Empty state
- **WHEN** the application launches with no folder loaded
- **THEN** a drop zone SHALL be displayed indicating support for folders and `.zip`/`.rar`/`.7z` archives
