## MODIFIED Requirements

### Requirement: Virtualized masonry grid
The application SHALL display images in a masonry (waterfall) layout using the masonic library with virtualization — only rendering images visible in the viewport. The grid SHALL support instant scroll jumps to arbitrary positions without freezing, by pre-populating the positioner with known image dimensions.

#### Scenario: Large collection rendering
- **WHEN** 5,000 images are loaded
- **THEN** only images within or near the visible viewport SHALL be rendered in the DOM

#### Scenario: Scroll jump performance
- **WHEN** 10,000 images are loaded and the user jumps from the top to the 8,000th image via scrollbar
- **THEN** the grid SHALL render the target viewport within one frame (no multi-second freeze)
- **AND** no more than the visible items plus overscan buffer SHALL be rendered in the DOM
