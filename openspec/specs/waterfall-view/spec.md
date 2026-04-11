## ADDED Requirements

### Requirement: Virtualized masonry grid
The application SHALL display images in a masonry (waterfall) layout using the masonic library with virtualization — only rendering images visible in the viewport. The grid SHALL support instant scroll jumps to arbitrary positions without freezing, by pre-populating the positioner with known image dimensions.

#### Scenario: Large collection rendering
- **WHEN** 5,000 images are loaded
- **THEN** only images within or near the visible viewport SHALL be rendered in the DOM

#### Scenario: Scroll jump performance
- **WHEN** 10,000 images are loaded and the user jumps from the top to the 8,000th image via scrollbar
- **THEN** the grid SHALL render the target viewport within one frame (no multi-second freeze)
- **AND** no more than the visible items plus overscan buffer SHALL be rendered in the DOM

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
Each grid cell SHALL render the image as a thumbnail. The thumbnail SHALL use the full-resolution image via asset protocol (no separate thumbnail generation in v2.0).

#### Scenario: Thumbnail display
- **WHEN** an image with known dimensions is rendered in the grid
- **THEN** the grid cell SHALL maintain the correct aspect ratio based on the image's width and height

### Requirement: Click to open viewer
Clicking an image thumbnail in the grid SHALL open the full-screen image viewer at that image's global position in the unfiltered image array, regardless of any active folder filter.

#### Scenario: Open viewer from filtered grid
- **WHEN** the grid is filtered to a subfolder and the user clicks an image
- **THEN** the image viewer SHALL open at that image's global index in the full image collection
- **AND** the viewer's left/right navigation SHALL traverse the full collection, not just the filtered set

#### Scenario: Open viewer without filter
- **WHEN** no folder filter is active and the user clicks on the 5th image in the grid
- **THEN** the image viewer SHALL open showing the 5th image
