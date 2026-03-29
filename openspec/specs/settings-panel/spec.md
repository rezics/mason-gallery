## ADDED Requirements

### Requirement: Settings UI
The application SHALL provide a settings panel accessible from the main UI (FAB button or titlebar menu). The settings panel SHALL be implemented as a MUI Drawer or Dialog.

#### Scenario: Open settings
- **WHEN** the user clicks the settings gear icon
- **THEN** a settings panel SHALL appear with all configurable options

### Requirement: Persistent settings storage
All user settings SHALL be persisted to disk using `tauri-plugin-store` and restored on application launch.

#### Scenario: Settings survive restart
- **WHEN** the user changes a setting and restarts the application
- **THEN** the changed setting SHALL retain its new value

### Requirement: Image format configuration
The user SHALL be able to configure which image file extensions are recognized (default: `.webp`, `.jxl`, `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.jfif`).

#### Scenario: Add format
- **WHEN** the user adds `.avif` to the image formats list
- **THEN** `.avif` files SHALL be included in subsequent directory scans

### Requirement: Sort method selection
The user SHALL be able to select the sort method from: `name-asc`, `name-desc`, `time-asc`, `time-desc`.

#### Scenario: Change sort triggers rescan
- **WHEN** the user changes the sort method while viewing a folder
- **THEN** the current view SHALL refresh with images in the new sort order

### Requirement: Per-page count configuration
The user SHALL be able to configure the number of images loaded per batch (page size). Default: 50.

#### Scenario: Adjust page size
- **WHEN** the user sets per-page count to 100
- **THEN** subsequent scans SHALL emit batches of up to 100 images

### Requirement: Language selection
The user SHALL be able to switch between English and Chinese (Simplified) from the settings panel.

#### Scenario: Switch language
- **WHEN** the user changes language to Chinese
- **THEN** all UI text SHALL immediately update to Chinese translations

### Requirement: Waterfall column configuration
The user SHALL be able to customize the responsive breakpoints for waterfall column count.

#### Scenario: Custom breakpoints
- **WHEN** the user sets 1200px breakpoint to 6 columns
- **THEN** the waterfall grid SHALL display 6 columns when the window width is ≤ 1200px
