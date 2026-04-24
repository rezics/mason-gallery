## MODIFIED Requirements

### Requirement: ImageEntry carries multi-resolution thumbnails
Each `ImageEntry` emitted by the Rust backend SHALL include an optional `thumbnails: Thumbnail[]` field. Each `Thumbnail` SHALL have `source` (the `mg-thumb://` URI), `width` (pixels, used for the `Nw` srcset descriptor), and `height` (pixels). When `thumbnails` is absent, `undefined`, or an empty array, the frontend SHALL render the original via `source` alone without `srcSet`. The array length SHALL equal the number of effective widths for the owning source (see `sources-cache` → per-source width override); for the default configuration this is one element.

#### Scenario: Archive entry includes thumbnails at resolved widths
- **WHEN** `scan_archive` emits an image entry for a source whose effective width list is `[800]`
- **THEN** the entry SHALL include a `thumbnails` array with one element at width 800 carrying a `mg-thumb://` URI

#### Scenario: Archive entry with per-source width override
- **WHEN** `scan_archive` emits an image entry for a source whose `policy_override.thumbnails.widths` is `[400, 800, 1600]`
- **THEN** the entry SHALL include a `thumbnails` array with three elements at those widths

#### Scenario: Folder entry without thumbnails
- **WHEN** `scan_directory` emits an image entry and folder thumbnails are not enabled
- **THEN** the entry SHALL have `thumbnails` absent or empty
