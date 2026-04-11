## Requirements

### Requirement: Scroll-preserving re-layout
The masonry grid SHALL support re-layout (re-sort and reset positioner) without clearing the image array, preserving the user's scroll position across the operation.

#### Scenario: Re-layout after sort change
- **WHEN** the user triggers a refresh while viewing a grid of 5,000 images scrolled to the 3,000th image
- **THEN** the grid SHALL re-sort and re-position all images
- **AND** the scroll position SHALL remain at approximately the same pixel offset as before the re-layout

#### Scenario: No blank screen during re-layout
- **WHEN** a re-layout is triggered
- **THEN** the existing images SHALL remain visible throughout the operation
- **AND** the grid SHALL NOT display a blank or empty state at any point

### Requirement: Relayout store action
The viewer store SHALL expose a `relayout()` action that increments `scanId` without clearing the image array or resetting scan state.

#### Scenario: relayout preserves images
- **WHEN** `relayout()` is called with 500 images in state
- **THEN** `scanId` SHALL increment by 1
- **AND** the `images` array SHALL still contain all 500 images
- **AND** `isScanning` SHALL remain `false`

### Requirement: Scroll position restoration timing
The scroll position SHALL be restored synchronously after DOM mutations using `useLayoutEffect`, so the user never perceives a scroll jump.

#### Scenario: No visible scroll jump
- **WHEN** a re-layout triggers a positioner reset
- **THEN** the container's `scrollTop` SHALL be captured before the reset
- **AND** restored in `useLayoutEffect` before the browser paints
