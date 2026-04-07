## ADDED Requirements

### Requirement: Client-side routing with wouter
The application SHALL use wouter for client-side routing with hash-based routing (suitable for Tauri's file-based loading).

#### Scenario: Navigation between routes
- **WHEN** the user navigates to `/about`
- **THEN** the About page component SHALL render

### Requirement: Route definitions
The application SHALL define the following routes:

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | HomePage | Main view with folder selector and waterfall grid |
| `/about` | AboutPage | Application information |

#### Scenario: Root route
- **WHEN** the application launches
- **THEN** the root route `/` SHALL be active and the HomePage SHALL render

#### Scenario: Unknown route
- **WHEN** the user navigates to an undefined route
- **THEN** the application SHALL redirect to `/`

### Requirement: Settings as overlay
Settings SHALL be accessible as a MUI Drawer overlay from any route, not as a separate route, matching the v1.4.0 pattern where settings were an overlay modal.

#### Scenario: Settings accessible from any page
- **WHEN** the user opens settings from the waterfall view
- **THEN** a Drawer SHALL slide in over the current view without changing the route
