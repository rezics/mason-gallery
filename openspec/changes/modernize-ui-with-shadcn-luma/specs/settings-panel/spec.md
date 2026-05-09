## MODIFIED Requirements

### Requirement: Settings UI
The application SHALL provide two settings surfaces: a quick gallery panel accessible from the main UI for frequent contextual controls, and dedicated settings routes for complete persistent configuration. The settings surfaces SHALL be implemented with the shared Tailwind/shadcn/Base UI component layer.

#### Scenario: Open quick settings
- **WHEN** the user clicks the settings or quick panel icon from the main UI
- **THEN** a quick gallery panel SHALL appear with frequent gallery and waterfall controls
- **AND** it SHALL include navigation to full settings routes.

#### Scenario: Open full settings
- **WHEN** the user navigates to `/settings`
- **THEN** the full settings experience SHALL appear with category navigation for persistent configuration.

### Requirement: Language selection
The user SHALL be able to switch between English and Chinese (Simplified) from the appearance settings route.

#### Scenario: Switch language
- **WHEN** the user changes language to Chinese
- **THEN** all UI text SHALL immediately update to Chinese translations

### Requirement: Archive cache cleanup strategy setting
The application SHALL include a "Cache Cleanup" option under an archive settings category with two choices: "Auto-clean on startup" (default) and "Keep all".

#### Scenario: Change cleanup strategy
- **WHEN** the user selects "Keep all" in the cache cleanup setting
- **THEN** the application SHALL stop auto-deleting caches on startup

#### Scenario: Setting persisted
- **WHEN** the user changes the cache cleanup strategy and restarts the application
- **THEN** the selected strategy SHALL be active

### Requirement: Password storage mode setting
The application SHALL include a "Password Storage" option under the archive settings category with three choices: "Don't save" (default), "Plaintext", and "Master password".

#### Scenario: Switch to master password mode
- **WHEN** the user selects "Master password" mode
- **THEN** the application SHALL prompt the user to create a master password

#### Scenario: Switch to don't save
- **WHEN** the user switches to "Don't save" mode
- **THEN** a confirmation dialog SHALL appear warning that all saved passwords will be deleted

### Requirement: Cache management link
The application SHALL include a "Manage Cache" link/button from archive or cache settings surfaces that navigates to the `/cache` route.

#### Scenario: Navigate to cache management
- **WHEN** the user clicks "Manage Cache" from settings
- **THEN** the application SHALL navigate to the cache management page

### Requirement: Cache policy settings section
The application SHALL include a cache settings category that configures the application-level `cachePolicy`. The section SHALL contain controls for: extracted-cache mode (`no-cache` / `lru-capped` / `unlimited`), extracted-cache per-source size cap (shown only when mode is `lru-capped`), extracted-cache minimum file size threshold, thumbnail retention mode (`until-source-removed` / `lru-capped`), thumbnail-cache total size cap (shown only when retention is `lru-capped`), and the list of thumbnail widths (`thumbnailSizes`).

#### Scenario: Changing extracted mode updates policy
- **WHEN** the user selects `no-cache` from the extracted-mode dropdown in the cache settings category
- **THEN** `cachePolicy.extracted.mode` SHALL persist to `"no-cache"` via `tauri-plugin-store`
- **AND** subsequent `/image` requests for archive entries SHALL extract to tempfiles without persisting

#### Scenario: LRU cap input shown conditionally
- **WHEN** the user sets extracted mode to `lru-capped`
- **THEN** the cache settings category SHALL display a numeric input for `maxSizePerSource` (in MB)
- **AND** when mode is changed to any other value, the input SHALL be hidden

### Requirement: Independent cache-clear actions
The cache settings category SHALL expose two distinct "Clear" buttons — one for thumbnails and one for extracted originals — that invoke `clear_thumbnails` and `clear_extracted` respectively without a source id (clearing all sources). The buttons SHALL display a confirmation dialog before proceeding.

#### Scenario: Clear thumbnails via settings
- **WHEN** the user clicks the "Clear thumbnail cache" button in cache settings and confirms
- **THEN** the frontend SHALL invoke `clear_thumbnails()` without arguments
- **AND** the extracted cache SHALL remain untouched

#### Scenario: Clear extracted via settings
- **WHEN** the user clicks the "Clear extracted cache" button in cache settings and confirms
- **THEN** the frontend SHALL invoke `clear_extracted()` without arguments
- **AND** the thumbnail cache SHALL remain untouched

### Requirement: Folder thumbnails mode setting
The application SHALL expose a `folderThumbnails` control with two values: `"off"` (default) and `"lazy"`. The control SHALL include helper text explaining that lazy thumbnails are generated on first view and benefit subsequent visits — not the first load. The setting SHALL persist via `tauri-plugin-store`.

#### Scenario: Default is off
- **WHEN** a user opens the relevant settings category for the first time (no prior `folderThumbnails` value stored)
- **THEN** the control SHALL display `"off"`

#### Scenario: Switching to lazy enables viewport observers
- **WHEN** the user sets `folderThumbnails` to `"lazy"`
- **THEN** subsequent folder scans SHALL emit entries without `thumbnails`, and the waterfall grid SHALL activate `IntersectionObserver`-based lazy requests
- **AND** the setting value SHALL persist across app restarts

#### Scenario: Switching to off disables requests
- **WHEN** the user sets `folderThumbnails` back to `"off"`
- **THEN** the waterfall grid SHALL stop issuing `requestThumbnail` calls
- **AND** existing folder thumbnail cache entries SHALL remain on disk (not deleted automatically; reusable if the user re-enables)
