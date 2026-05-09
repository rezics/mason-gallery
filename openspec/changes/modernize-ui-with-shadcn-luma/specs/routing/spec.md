## MODIFIED Requirements

### Requirement: Route definitions
The application SHALL define the following routes:

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | HomePage | Main view with folder selector and waterfall grid |
| `/about` | AboutPage | Application information |
| `/cache` | CachePage | Cache management |
| `/settings` | SettingsPage | Settings overview or default settings category |
| `/settings/appearance` | SettingsPage | Appearance, theme, and language settings |
| `/settings/gallery` | SettingsPage | Gallery and waterfall settings |
| `/settings/files` | SettingsPage | File format and deletion behavior settings |
| `/settings/archive` | SettingsPage | Archive-related settings when supported |
| `/settings/cache` | SettingsPage | Application cache policy and cache actions when supported |
| `/settings/advanced` | SettingsPage | Advanced settings |

#### Scenario: Root route
- **WHEN** the application launches
- **THEN** the root route `/` SHALL be active and the HomePage SHALL render

#### Scenario: Unknown route
- **WHEN** the user navigates to an undefined route
- **THEN** the application SHALL redirect to `/`

### Requirement: Settings as overlay
Settings SHALL be accessible as a quick right-side overlay from gallery routes for frequent controls, while full settings SHALL be accessible through dedicated settings routes.

#### Scenario: Quick settings accessible from gallery
- **WHEN** the user opens quick settings from the waterfall view
- **THEN** a quick panel SHALL slide in over the current view without changing the route

#### Scenario: Full settings accessible as route
- **WHEN** the user opens full settings from the quick panel or app chrome
- **THEN** the application SHALL navigate to `/settings` or a nested settings route
