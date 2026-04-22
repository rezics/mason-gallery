## MODIFIED Requirements

### Requirement: Image thumbnail rendering
Each grid cell SHALL render the image with a single `<img>` element whose attributes are injected dynamically based on what the `ImageEntry` provides. The `src` attribute SHALL be derived from `platform.getImageUrl(entry.source)`. When `entry.thumbnails` is non-empty, the cell SHALL produce a `srcSet` attribute of the form `"<url1> <w1>w, <url2> <w2>w, ..."` by calling `platform.getThumbUrl(thumb.source)` for each entry, and SHALL set a `sizes` attribute reflecting the current grid column width. When `entry.thumbnails` is absent or empty, the cell SHALL render only `src` (the original) — no `srcSet`. The cell SHALL forward `entry.width` / `entry.height` as the `<img>` `width` / `height` attributes when they are known, regardless of whether thumbnails are present.

#### Scenario: Archive entry with thumbnails drives srcset
- **WHEN** a grid cell receives an entry with `source="archive:///pack.zip#a.jpg"` and `thumbnails=[{width:400,...},{width:800,...},{width:1600,...}]`
- **THEN** the rendered `<img>` SHALL have a `srcSet` with three comma-separated thumbnail URLs each tagged with their `Nw` width descriptor
- **AND** the browser SHALL load only the thumbnail matching the current column width (not the original)

#### Scenario: Folder entry without thumbnails renders original
- **WHEN** a grid cell receives an entry with `source="D:/photos/a.jpg"` and no `thumbnails`
- **THEN** the rendered `<img>` SHALL have `src="<image-http-url-for-original>"` with no `srcSet`
- **AND** aspect ratio SHALL be preserved via `width`/`height` attributes when known

#### Scenario: Known dimensions preserved across render branches
- **WHEN** a grid cell receives an entry with `width=1920`, `height=1080`
- **THEN** the `<img>` element SHALL include `width="1920"` and `height="1080"` attributes whether or not `thumbnails` is present

#### Scenario: No branching render paths
- **WHEN** the cell's render function is inspected
- **THEN** there SHALL be exactly one `<img>` element in the returned JSX (no `if/else` producing different element trees) — attributes SHALL be computed conditionally and spread into the single element
