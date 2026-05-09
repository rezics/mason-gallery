## ADDED Requirements

### Requirement: Dedicated settings route hierarchy
The application SHALL provide dedicated settings routes for persistent and low-frequency configuration.

#### Scenario: Settings routes are available
- **WHEN** the user navigates to `/settings`
- **THEN** a settings overview or default settings category SHALL render.

#### Scenario: Settings categories are available
- **WHEN** the user navigates to `/settings/appearance`, `/settings/gallery`, `/settings/files`, `/settings/archive`, `/settings/cache`, or `/settings/advanced`
- **THEN** the corresponding settings category SHALL render if it is supported by the active platform.

### Requirement: Settings category navigation
The settings route UI SHALL provide category navigation without obscuring the current category content.

#### Scenario: Switch settings category
- **WHEN** the user selects a settings category from the settings route navigation
- **THEN** the route SHALL update to that category
- **AND** the selected category content SHALL replace the previous category content.

### Requirement: Platform gated settings categories
Settings categories and controls that require desktop-only archive or cache capabilities SHALL be hidden or disabled when the active platform does not support them.

#### Scenario: Web target without archive support
- **WHEN** the web target does not support archive browsing or archive cache management
- **THEN** archive-specific settings SHALL NOT be presented as active controls.

### Requirement: Existing setting semantics preserved
Moving controls from the drawer to settings routes SHALL preserve existing setting values, persistence keys, and behavior unless another requirement explicitly changes them.

#### Scenario: Existing setting persists after relocation
- **WHEN** the user changes `pageSize`, `formats`, `cachePolicy`, or `folderThumbnails` from a settings route
- **THEN** the same persisted setting key SHALL be updated as before the route migration.

### Requirement: Appearance settings include theme preference
The appearance settings route SHALL include the theme preference control.

#### Scenario: Change theme from appearance settings
- **WHEN** the user changes theme preference from `/settings/appearance`
- **THEN** the active theme SHALL update immediately
- **AND** the preference SHALL persist across app restarts.
