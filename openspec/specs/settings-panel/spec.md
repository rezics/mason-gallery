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

### Requirement: Grid position indicator toggle
The settings panel SHALL include a toggle to show or hide the grid position indicator and jump-to-index UI in the stats bar. The default value SHALL be `true` (visible).

#### Scenario: Disable position indicator
- **WHEN** the user disables the "Show grid position" toggle in settings
- **THEN** the stats bar SHALL only show the total image count without position or jump UI

#### Scenario: Enable position indicator
- **WHEN** the user enables the "Show grid position" toggle in settings
- **THEN** the stats bar SHALL display the position indicator and jump functionality

#### Scenario: Setting persists across sessions
- **WHEN** the user disables the grid position indicator and restarts the application
- **THEN** the grid position indicator SHALL remain hidden

### Requirement: Archive cache cleanup strategy setting
The settings panel SHALL include a "Cache Cleanup" option under an "Archives" section with two choices: "Auto-clean on startup" (default) and "Keep all".

#### Scenario: Change cleanup strategy
- **WHEN** the user selects "Keep all" in the cache cleanup setting
- **THEN** the application SHALL stop auto-deleting caches on startup

#### Scenario: Setting persisted
- **WHEN** the user changes the cache cleanup strategy and restarts the application
- **THEN** the selected strategy SHALL be active

### Requirement: Password storage mode setting
The settings panel SHALL include a "Password Storage" option under the "Archives" section with three choices: "Don't save" (default), "Plaintext", and "Master password".

#### Scenario: Switch to master password mode
- **WHEN** the user selects "Master password" mode
- **THEN** the application SHALL prompt the user to create a master password

#### Scenario: Switch to don't save
- **WHEN** the user switches to "Don't save" mode
- **THEN** a confirmation dialog SHALL appear warning that all saved passwords will be deleted

### Requirement: Cache management link
The settings panel SHALL include a "Manage Cache" link/button that navigates to the `/cache` route.

#### Scenario: Navigate to cache management
- **WHEN** the user clicks "Manage Cache" in settings
- **THEN** the application SHALL navigate to the cache management page

### Requirement: Cache policy settings section
The settings panel SHALL include a "Cache" section that configures the application-level `cachePolicy`. The section SHALL contain controls for: extracted-cache mode (`no-cache` / `lru-capped` / `unlimited`), extracted-cache per-source size cap (shown only when mode is `lru-capped`), extracted-cache minimum file size threshold, thumbnail retention mode (`until-source-removed` / `lru-capped`), thumbnail-cache total size cap (shown only when retention is `lru-capped`), and the list of thumbnail widths (`thumbnailSizes`).

#### Scenario: Changing extracted mode updates policy
- **WHEN** the user selects `no-cache` from the extracted-mode dropdown in the settings panel
- **THEN** `cachePolicy.extracted.mode` SHALL persist to `"no-cache"` via `tauri-plugin-store`
- **AND** subsequent `/image` requests for archive entries SHALL extract to tempfiles without persisting

#### Scenario: LRU cap input shown conditionally
- **WHEN** the user sets extracted mode to `lru-capped`
- **THEN** the settings panel SHALL display a numeric input for `maxSizePerSource` (in MB)
- **AND** when mode is changed to any other value, the input SHALL be hidden

### Requirement: Independent cache-clear actions
The settings panel SHALL expose two distinct "Clear" buttons — one for thumbnails and one for extracted originals — that invoke `clear_thumbnails` and `clear_extracted` respectively without a source id (clearing all sources). The buttons SHALL display a confirmation dialog before proceeding.

#### Scenario: Clear thumbnails via settings
- **WHEN** the user clicks the "Clear thumbnail cache" button in the settings panel and confirms
- **THEN** the frontend SHALL invoke `clear_thumbnails()` without arguments
- **AND** the extracted cache SHALL remain untouched

#### Scenario: Clear extracted via settings
- **WHEN** the user clicks the "Clear extracted cache" button in the settings panel and confirms
- **THEN** the frontend SHALL invoke `clear_extracted()` without arguments
- **AND** the thumbnail cache SHALL remain untouched

### Requirement: Per-source policy override UI
The cache management page (or a dedicated panel) SHALL allow each source to override the application-level policy. The UI SHALL display the currently effective policy (merged) and provide controls to set any individual field, unset it (reverting to application default), or reset all overrides for that source.

#### Scenario: Set a single override
- **WHEN** the user selects a source and changes its extracted mode to `unlimited` while other fields remain unset
- **THEN** the source's `policy_override` SHALL persist `{"extracted":{"mode":"unlimited"}}` as JSON
- **AND** all unset fields SHALL continue to inherit from the application-level `cachePolicy`

#### Scenario: Reset a source override
- **WHEN** the user clicks "Reset to defaults" on a source with existing overrides
- **THEN** `policy_override` SHALL be set to `NULL` in the `sources` table
- **AND** the source SHALL once again use the full application-level policy

### Requirement: Folder thumbnails mode setting
The settings panel SHALL expose a `folderThumbnails` control with two values: `"off"` (default) and `"lazy"`. The control SHALL include helper text explaining that lazy thumbnails are generated on first view and benefit subsequent visits — not the first load. The setting SHALL persist via `tauri-plugin-store`.

#### Scenario: Default is off
- **WHEN** a user opens the settings panel for the first time (no prior `folderThumbnails` value stored)
- **THEN** the control SHALL display `"off"`

#### Scenario: Switching to lazy enables viewport observers
- **WHEN** the user sets `folderThumbnails` to `"lazy"`
- **THEN** subsequent folder scans SHALL emit entries without `thumbnails`, and the waterfall grid SHALL activate `IntersectionObserver`-based lazy requests
- **AND** the setting value SHALL persist across app restarts

#### Scenario: Switching to off disables requests
- **WHEN** the user sets `folderThumbnails` back to `"off"`
- **THEN** the waterfall grid SHALL stop issuing `requestThumbnail` calls
- **AND** existing folder thumbnail cache entries SHALL remain on disk (not deleted automatically; reusable if the user re-enables)

### Requirement: Helper text for cost/benefit
The `folderThumbnails` control SHALL include localized helper text clarifying that lazy thumbnails are **not** a first-view speedup — the original is still downloaded on first render — and that the benefit applies to re-visiting the same collection in the future.

#### Scenario: Helper text visible
- **WHEN** the user hovers or focuses the `folderThumbnails` control
- **THEN** a tooltip or caption SHALL explain the lazy strategy's characteristics (first view uses original, subsequent views use thumb)
