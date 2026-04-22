## ADDED Requirements

### Requirement: Virtualized masonry grid
The application SHALL display images in a masonry (waterfall) layout using the masonic library with virtualization — only rendering images visible in the viewport. The grid SHALL support instant scroll jumps to arbitrary positions without freezing, by pre-populating the positioner with known image dimensions. The WaterfallGrid component SHALL expose its positioner instance to parent components via an `onPositionerReady` callback prop, enabling external features such as scroll-to-index and position estimation.

#### Scenario: Large collection rendering
- **WHEN** 5,000 images are loaded
- **THEN** only images within or near the visible viewport SHALL be rendered in the DOM

#### Scenario: Scroll jump performance
- **WHEN** 10,000 images are loaded and the user jumps from the top to the 8,000th image via scrollbar
- **THEN** the grid SHALL render the target viewport within one frame (no multi-second freeze)
- **AND** no more than the visible items plus overscan buffer SHALL be rendered in the DOM

#### Scenario: Positioner accessible externally
- **WHEN** the WaterfallGrid mounts and the positioner is initialized
- **THEN** the parent component SHALL receive the positioner instance via the `onPositionerReady` callback
- **AND** when the positioner is recreated (due to scan or column change), the callback SHALL fire again with the new instance

### Requirement: Responsive column breakpoints
The masonry grid SHALL adjust column count based on window width with configurable breakpoints.

#### Scenario: Default breakpoints
- **WHEN** window width ≤ 500px → 2 columns
- **WHEN** window width ≤ 800px → 3 columns
- **WHEN** window width ≤ 1200px → 4 columns
- **WHEN** window width ≤ 1400px → 5 columns
- **THEN** the grid SHALL display the corresponding number of columns

### Requirement: Progressive image loading
The grid SHALL display images progressively as batches arrive from the Rust file engine, without waiting for the full scan to complete.

#### Scenario: Streaming display
- **WHEN** the first batch of images arrives from the backend
- **THEN** those images SHALL immediately appear in the grid while scanning continues

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

### Requirement: Click to open viewer
Clicking an image thumbnail in the grid SHALL open the full-screen image viewer at that image's global position in the unfiltered image array, regardless of any active folder filter.

#### Scenario: Open viewer from filtered grid
- **WHEN** the grid is filtered to a subfolder and the user clicks an image
- **THEN** the image viewer SHALL open at that image's global index in the full image collection
- **AND** the viewer's left/right navigation SHALL traverse the full collection, not just the filtered set

#### Scenario: Open viewer without filter
- **WHEN** no folder filter is active and the user clicks on the 5th image in the grid
- **THEN** the image viewer SHALL open showing the 5th image
