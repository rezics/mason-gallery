## ADDED Requirements

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
