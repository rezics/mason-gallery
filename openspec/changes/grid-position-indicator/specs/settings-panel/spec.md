## ADDED Requirements

### Requirement: Grid position indicator toggle
The settings panel SHALL include a toggle to show or hide the grid position indicator and jump-to-index UI in the stats bar. The default value SHALL be `true` (visible).

#### Scenario: Disable position indicator
- **WHEN** the user disables the "Show grid position" toggle in settings
- **THEN** the stats bar SHALL only show the total image count without position or jump UI

#### Scenario: Enable position indicator
- **WHEN** the user enables the "Show grid position" toggle in settings
- **THEN** the stats bar SHALL display the position indicator and jump functionality

#### Scenario: Setting persists across sessions
- **WHEN** the user disables the grid position indicator and restarts the application
- **THEN** the grid position indicator SHALL remain hidden
