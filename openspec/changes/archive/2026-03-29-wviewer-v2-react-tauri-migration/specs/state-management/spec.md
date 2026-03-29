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
The application SHALL maintain a Zustand store (`useViewerStore`) for runtime viewer state: the current image list, current image index, viewer open/closed state, and scan progress.

#### Scenario: Image batch appended
- **WHEN** an `images:batch` event arrives from the backend
- **THEN** the images SHALL be appended to the viewer store's image list

#### Scenario: Viewer state reset
- **WHEN** the user resets the folder selection
- **THEN** the viewer store SHALL clear the image list and reset all state

### Requirement: App store
The application SHALL maintain a Zustand store (`useAppStore`) for application-level state: selected folder paths, UI flags (settings panel open, etc.).

#### Scenario: Folder paths tracked
- **WHEN** the user selects folders via dialog or drag-and-drop
- **THEN** the selected folder paths SHALL be stored in the app store
