## MODIFIED Requirements

### Requirement: Reset and reload
The application SHALL provide separate actions for refresh (incremental, scroll-preserving) and full reset (clear everything and return to empty state). The refresh action SHALL perform a two-phase incremental refresh. The reset action SHALL clear the current image collection and return to the drop zone.

#### Scenario: Refresh preserves state
- **WHEN** the user clicks the refresh button
- **THEN** the current images SHALL remain visible
- **AND** an incremental scan SHALL detect added/removed files
- **AND** scroll position SHALL be preserved

#### Scenario: Reset clears state
- **WHEN** the user explicitly triggers a full reset (e.g., via resetToDropZone)
- **THEN** the current image collection SHALL be cleared and the drop zone SHALL be shown
