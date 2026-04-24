## MODIFIED Requirements

### Requirement: Cache policy settings section
The settings panel SHALL include a "Cache" section that configures the application-level `cachePolicy`. The section SHALL contain controls for: extracted-cache mode (`no-cache` / `lru-capped` / `unlimited`), extracted-cache per-source size cap (shown only when mode is `lru-capped`), extracted-cache minimum file size threshold, thumbnail retention mode (`until-source-removed` / `lru-capped`), thumbnail-cache total size cap (shown only when retention is `lru-capped`), and the list of thumbnail widths (`thumbnailSizes`). The default value for `thumbnailSizes` SHALL be `[800]`. The control SHALL include helper text explaining that additional widths improve rendering quality on high-DPI displays at the cost of longer scan times and more disk usage.

#### Scenario: Changing extracted mode updates policy
- **WHEN** the user selects `no-cache` from the extracted-mode dropdown in the settings panel
- **THEN** `cachePolicy.extracted.mode` SHALL persist to `"no-cache"` via `tauri-plugin-store`
- **AND** subsequent `/image` requests for archive entries SHALL extract to tempfiles without persisting

#### Scenario: LRU cap input shown conditionally
- **WHEN** the user sets extracted mode to `lru-capped`
- **THEN** the settings panel SHALL display a numeric input for `maxSizePerSource` (in MB)
- **AND** when mode is changed to any other value, the input SHALL be hidden

#### Scenario: Default thumbnail widths on fresh install
- **WHEN** a user opens the settings panel for the first time (no prior `thumbnailSizes` value stored)
- **THEN** the `thumbnailSizes` control SHALL display `[800]`

#### Scenario: Thumbnail widths sync to Rust on change
- **WHEN** the user changes `thumbnailSizes` in the settings panel
- **THEN** the frontend SHALL invoke `setCachePolicy` with the updated list within the same commit
- **AND** subsequent archive scans SHALL use the new list

### Requirement: Per-source policy override UI
The cache management page (or a dedicated panel) SHALL allow each source to override the application-level policy. The UI SHALL display the currently effective policy (merged) and provide controls to set any individual field, unset it (reverting to application default), or reset all overrides for that source. The thumbnail section SHALL additionally allow overriding the widths array for that specific source; the widths field, when set, MUST contain at least one value.

#### Scenario: Set a single override
- **WHEN** the user selects a source and changes its extracted mode to `unlimited` while other fields remain unset
- **THEN** the source's `policy_override` SHALL persist `{"extracted":{"mode":"unlimited"}}` as JSON
- **AND** all unset fields SHALL continue to inherit from the application-level `cachePolicy`

#### Scenario: Reset a source override
- **WHEN** the user clicks "Reset to defaults" on a source with existing overrides
- **THEN** `policy_override` SHALL be set to `NULL` in the `sources` table
- **AND** the source SHALL once again use the full application-level policy

#### Scenario: Override thumbnail widths for a source
- **WHEN** the user edits a source's override to set `thumbnails.widths=[400,800,1600]`
- **THEN** the source's `policy_override` SHALL persist that widths array
- **AND** subsequent scans or thumbnail generations for that source SHALL produce three widths per entry

#### Scenario: Empty widths override blocked in UI
- **WHEN** the user attempts to save a widths override with zero values
- **THEN** the UI SHALL display a validation error and SHALL NOT invoke `setSourcePolicy`
