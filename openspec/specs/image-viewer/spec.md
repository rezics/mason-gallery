## ADDED Requirements

### Requirement: Full-screen lightbox viewer
The application SHALL provide a full-screen lightbox image viewer using yet-another-react-lightbox.

#### Scenario: Lightbox opens
- **WHEN** an image is selected from the waterfall grid
- **THEN** a full-screen lightbox SHALL display the image

### Requirement: Image navigation
The viewer SHALL support navigating between images using left/right arrow keys and on-screen navigation controls.

#### Scenario: Keyboard navigation
- **WHEN** the viewer is open and the user presses the right arrow key
- **THEN** the viewer SHALL display the next image in the collection

#### Scenario: Previous image
- **WHEN** the viewer is open and the user presses the left arrow key
- **THEN** the viewer SHALL display the previous image in the collection

### Requirement: Zoom and pan
The viewer SHALL support zooming into images via Ctrl + mouse wheel and panning zoomed images.

#### Scenario: Zoom in
- **WHEN** the user holds Ctrl and scrolls the mouse wheel up
- **THEN** the image SHALL zoom in centered on the cursor position

#### Scenario: Pan zoomed image
- **WHEN** the image is zoomed in and the user clicks and drags
- **THEN** the image SHALL pan to follow the cursor

### Requirement: Close viewer
The viewer SHALL close when the user presses Escape or clicks outside the image.

#### Scenario: Escape to close
- **WHEN** the user presses Escape while the viewer is open
- **THEN** the viewer SHALL close and return to the waterfall grid

### Requirement: Delete current image
The viewer SHALL support deleting the currently viewed image to the system trash via the Delete key.

#### Scenario: Delete via keyboard
- **WHEN** the user presses the Delete key while viewing an image
- **THEN** the image SHALL be moved to the system trash, removed from the collection, and the viewer SHALL advance to the next image

### Requirement: Auto-position on close
When the viewer is closed, the waterfall grid SHALL scroll to make the last-viewed image visible.

#### Scenario: Return to position
- **WHEN** the user closes the viewer after viewing the 50th image
- **THEN** the waterfall grid SHALL scroll so the 50th image is visible in the viewport
