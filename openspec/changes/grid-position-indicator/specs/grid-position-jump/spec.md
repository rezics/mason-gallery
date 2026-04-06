## ADDED Requirements

### Requirement: Grid position indicator
The stats bar SHALL display the approximate index of the first visible image in the masonry grid alongside the total image count, formatted as `~{current} / {total}`.

#### Scenario: Position shown while browsing
- **WHEN** the user scrolls the masonry grid containing 1,280 images to approximately the 420th image
- **THEN** the stats bar SHALL display `~420 / 1,280`

#### Scenario: Position updates on scroll
- **WHEN** the user scrolls down through the grid
- **THEN** the current position number SHALL update in real-time as the viewport moves

#### Scenario: Position resets on new scan
- **WHEN** a new folder is scanned
- **THEN** the position indicator SHALL reset to `~1 / {new total}`

### Requirement: Jump to index
The user SHALL be able to jump to any image position in the masonry grid by entering an image number.

#### Scenario: Jump via input
- **WHEN** the user clicks the position indicator or presses Ctrl+G
- **THEN** an inline number input SHALL appear in the stats bar
- **AND** the user enters `800` and presses Enter
- **THEN** the masonry grid SHALL scroll to make the 800th image visible

#### Scenario: Jump to boundary values
- **WHEN** the user enters `0` or a negative number in the jump input
- **THEN** the grid SHALL scroll to the first image

#### Scenario: Jump exceeds total
- **WHEN** the user enters a number greater than the total image count
- **THEN** the grid SHALL scroll to the last image

#### Scenario: Cancel jump
- **WHEN** the user presses Escape while the jump input is visible
- **THEN** the input SHALL close without scrolling

### Requirement: Lightbox image counter
The lightbox viewer SHALL display the current image index and total count using the yet-another-react-lightbox Counter plugin.

#### Scenario: Counter visible in viewer
- **WHEN** the user opens the lightbox viewer on the 42nd image out of 1,280
- **THEN** the viewer toolbar SHALL display `42 / 1,280`

#### Scenario: Counter updates on navigation
- **WHEN** the user navigates to the next image in the lightbox
- **THEN** the counter SHALL update to reflect the new position
