## MODIFIED Requirements

### Requirement: Frameless window with custom titlebar
The application SHALL run in a frameless window (`"decorations": false` in tauri.conf.json) with a custom titlebar implemented using the shared Tailwind/shadcn/Base UI component layer.

#### Scenario: Window renders without native titlebar
- **WHEN** the application launches
- **THEN** the native OS titlebar SHALL not be visible and a custom application titlebar SHALL appear at the top of the window
