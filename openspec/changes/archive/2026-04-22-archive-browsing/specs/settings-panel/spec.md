## ADDED Requirements

### Requirement: Archive cache cleanup strategy setting
The settings panel SHALL include a "Cache Cleanup" option under an "Archives" section with two choices: "Auto-clean on startup" (default) and "Keep all".

#### Scenario: Change cleanup strategy
- **WHEN** the user selects "Keep all" in the cache cleanup setting
- **THEN** the application SHALL stop auto-deleting caches on startup

#### Scenario: Setting persisted
- **WHEN** the user changes the cache cleanup strategy and restarts the application
- **THEN** the selected strategy SHALL be active

### Requirement: Password storage mode setting
The settings panel SHALL include a "Password Storage" option under the "Archives" section with three choices: "Don't save" (default), "Plaintext", and "Master password".

#### Scenario: Switch to master password mode
- **WHEN** the user selects "Master password" mode
- **THEN** the application SHALL prompt the user to create a master password

#### Scenario: Switch to don't save
- **WHEN** the user switches to "Don't save" mode
- **THEN** a confirmation dialog SHALL appear warning that all saved passwords will be deleted

### Requirement: Cache management link
The settings panel SHALL include a "Manage Cache" link/button that navigates to the `/cache` route.

#### Scenario: Navigate to cache management
- **WHEN** the user clicks "Manage Cache" in settings
- **THEN** the application SHALL navigate to the cache management page
