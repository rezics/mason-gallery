## ADDED Requirements

### Requirement: Virtualized masonry grid
The application SHALL display images in a masonry (waterfall) layout using the masonic library with virtualization — only rendering images visible in the viewport.

#### Scenario: Large collection rendering
- **WHEN** 5000 images are loaded
- **THEN** only images within or near the visible viewport SHALL be rendered in the DOM

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
Clicking an image thumbnail in the grid SHALL open the full-screen image viewer at that image's position.

#### Scenario: Open viewer
- **WHEN** the user clicks on the 5th image in the grid
- **THEN** the image viewer SHALL open showing the 5th image
