## ADDED Requirements

### Requirement: Quick gallery panel
The application SHALL provide a right-side quick panel for frequent, contextual gallery controls instead of using the panel as the complete settings surface.

#### Scenario: Open quick panel
- **WHEN** the user clicks the quick panel or settings control from the main chrome
- **THEN** a right-side panel SHALL open without navigating away from the current gallery route.

### Requirement: Frequent waterfall controls
The quick panel SHALL expose controls for high-frequency waterfall and gallery-view adjustments.

#### Scenario: Adjust gallery controls
- **WHEN** the quick panel is open while images are loaded
- **THEN** the user SHALL be able to adjust frequent controls such as sort method, grid position visibility, page size or load density, and waterfall column behavior from the panel.

### Requirement: Quick panel links to full settings
The quick panel SHALL link to the relevant full settings routes for lower-frequency options.

#### Scenario: Navigate from quick panel to full settings
- **WHEN** the user selects an "All settings" or category link from the quick panel
- **THEN** the quick panel SHALL close
- **AND** the application SHALL navigate to the selected settings route.

### Requirement: Quick panel is not the settings authority
The quick panel SHALL NOT be required to contain every configurable option.

#### Scenario: Cache policy omitted from quick panel
- **WHEN** the user opens the quick panel
- **THEN** complex cache policy controls SHALL be absent from the quick panel
- **AND** cache policy controls SHALL be available from a dedicated settings route when supported by the platform.
