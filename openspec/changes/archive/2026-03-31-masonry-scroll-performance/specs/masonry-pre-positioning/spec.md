## ADDED Requirements

### Requirement: Pre-calculated masonry positions
The masonry grid SHALL pre-populate the positioner with calculated item heights for all images that have known dimensions, before the masonry render hook consumes the positioner.

#### Scenario: All images have known dimensions
- **WHEN** 10,000 images with known width and height are loaded
- **THEN** the positioner SHALL have all 10,000 positions computed before `useMasonry` executes
- **AND** `needsFreshBatch` SHALL be `false` at every scroll position

#### Scenario: Incremental batch arrival
- **WHEN** a new batch of images is appended to the store (during scanning)
- **THEN** on the next render cycle, the positioner SHALL be filled for the newly added items without re-filling already-positioned items

#### Scenario: Images without dimensions
- **WHEN** an image has `width === null` or `height === null`
- **THEN** the pre-positioning logic SHALL skip that image
- **AND** masonic SHALL handle it via its default DOM measurement path

### Requirement: Height calculation formula
The pre-calculated height for an image SHALL be `positioner.columnWidth × (image.height / image.width)`, matching the CSS `aspect-ratio` rendering of the ImageCell component.

#### Scenario: Aspect ratio preservation
- **WHEN** an image with dimensions 1920×1080 is pre-positioned in a column of width 300px
- **THEN** the calculated height SHALL be 168.75px (300 × 1080/1920) with sub-pixel precision

### Requirement: Positioner recreation compatibility
When the positioner is recreated (due to column count or width changes), the pre-positioning logic SHALL re-compute all positions using the new column width.

#### Scenario: Window resize changes column count
- **WHEN** the window is resized causing column count to change from 4 to 3
- **THEN** the new positioner SHALL be fully pre-filled on the next render
- **AND** scrolling SHALL remain smooth without batch catch-up
