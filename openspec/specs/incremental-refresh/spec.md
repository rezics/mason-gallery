## Requirements

### Requirement: Incremental filesystem diff
The application SHALL support an incremental refresh that compares the current in-memory image paths against a fresh filesystem scan, identifying added and removed files without clearing the existing image set.

#### Scenario: New files detected
- **WHEN** an incremental refresh runs and the filesystem contains 3 images not present in the current image set
- **THEN** those 3 images (with dimensions) SHALL be added to the image array
- **AND** the existing images SHALL remain in the array unchanged

#### Scenario: Deleted files detected
- **WHEN** an incremental refresh runs and 2 images in the current set no longer exist on disk
- **THEN** those 2 images SHALL be removed from the image array
- **AND** the remaining images SHALL remain unchanged

#### Scenario: No changes on disk
- **WHEN** an incremental refresh runs and the filesystem matches the current image set exactly
- **THEN** the image array SHALL remain unchanged
- **AND** no re-layout SHALL be triggered

### Requirement: Merge store action
The viewer store SHALL expose a `mergeImages(added, removedPaths)` action that splices new images into the array and filters out removed paths.

#### Scenario: Merge additions and removals
- **WHEN** `mergeImages([imgA, imgB], ["/old/deleted.jpg"])` is called
- **THEN** `imgA` and `imgB` SHALL be appended to the images array
- **AND** any image with source `/old/deleted.jpg` SHALL be removed from the array

### Requirement: Stale scan discard
If a new refresh is triggered while an incremental scan is still running, the results of the stale scan SHALL be discarded.

#### Scenario: Rapid double-refresh
- **WHEN** the user triggers refresh twice in quick succession
- **THEN** the first scan's results SHALL be discarded when they arrive
- **AND** only the second scan's results SHALL be applied

### Requirement: Two-phase refresh orchestration
The refresh action SHALL execute in two phases: (1) instant re-layout of existing images, (2) background incremental scan with conditional re-layout if changes are found.

#### Scenario: Full refresh flow
- **WHEN** the user clicks the refresh button
- **THEN** the grid SHALL immediately re-layout existing images with scroll preservation
- **AND** an incremental scan SHALL begin in the background
- **AND** if the scan finds additions or removals, the changes SHALL be merged and the grid SHALL re-layout again with scroll preservation
