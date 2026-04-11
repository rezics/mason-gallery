## ADDED Requirements

### Requirement: Native folder selection dialog
The application SHALL allow users to select one or more folders via a native OS folder picker dialog using `tauri-plugin-dialog`.

#### Scenario: Select single folder
- **WHEN** the user clicks the folder selection UI element and selects one folder
- **THEN** the application SHALL begin scanning that folder for images

#### Scenario: Select multiple folders
- **WHEN** the user selects multiple folders in the dialog
- **THEN** the application SHALL scan all selected folders

### Requirement: Drag-and-drop folder opening
The application SHALL accept folders dragged and dropped onto the application window.

#### Scenario: Drop single folder
- **WHEN** the user drags a folder from the file manager and drops it onto the application window
- **THEN** the application SHALL begin scanning the dropped folder for images

#### Scenario: Drop multiple folders
- **WHEN** the user drops multiple folders onto the application window
- **THEN** the application SHALL scan all dropped folders

### Requirement: Upload/drop zone UI
When no folder is loaded, the application SHALL display a prominent upload/drop zone with instructions, similar to the v1.4.0 landing page.

#### Scenario: Empty state
- **WHEN** the application launches with no folder loaded
- **THEN** a drop zone with instructions SHALL be displayed prominently

### Requirement: Reset and reload
The application SHALL provide separate actions for refresh (incremental, scroll-preserving) and full reset (clear everything and return to empty state). The refresh action SHALL perform a two-phase incremental refresh. The reset action SHALL clear the current image collection and return to the drop zone.

#### Scenario: Refresh preserves state
- **WHEN** the user clicks the refresh button
- **THEN** the current images SHALL remain visible
- **AND** an incremental scan SHALL detect added/removed files
- **AND** scroll position SHALL be preserved

#### Scenario: Reset clears state
- **WHEN** the user explicitly triggers a full reset (e.g., via resetToDropZone)
- **THEN** the current image collection SHALL be cleared and the drop zone SHALL be shown
