## MODIFIED Requirements

### Requirement: Click to open viewer
Clicking an image thumbnail in the grid SHALL open the full-screen image viewer at that image's global position in the unfiltered image array, regardless of any active folder filter.

#### Scenario: Open viewer from filtered grid
- **WHEN** the grid is filtered to a subfolder and the user clicks an image
- **THEN** the image viewer SHALL open at that image's global index in the full image collection
- **AND** the viewer's left/right navigation SHALL traverse the full collection, not just the filtered set

#### Scenario: Open viewer without filter
- **WHEN** no folder filter is active and the user clicks on the 5th image in the grid
- **THEN** the image viewer SHALL open showing the 5th image
