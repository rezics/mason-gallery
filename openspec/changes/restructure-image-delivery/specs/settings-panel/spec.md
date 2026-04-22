## ADDED Requirements

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
