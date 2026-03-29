## ADDED Requirements

### Requirement: Frameless window with custom titlebar
The application SHALL run in a frameless window (`"decorations": false` in tauri.conf.json) with a custom titlebar implemented using MUI's AppBar component.

#### Scenario: Window renders without native titlebar
- **WHEN** the application launches
- **THEN** the native OS titlebar SHALL not be visible and a custom MUI AppBar SHALL appear at the top of the window

### Requirement: Titlebar drag region
The custom titlebar SHALL be draggable to move the window. Non-interactive areas SHALL use `data-tauri-drag-region`.

#### Scenario: Window dragging
- **WHEN** the user clicks and drags on the titlebar background
- **THEN** the application window SHALL move with the cursor

#### Scenario: Menu interaction does not drag
- **WHEN** the user clicks on a menu item or button in the titlebar
- **THEN** the window SHALL not move

### Requirement: Window control buttons
The titlebar SHALL include minimize, maximize/restore, and close buttons.

#### Scenario: Minimize
- **WHEN** the user clicks the minimize button
- **THEN** the window SHALL minimize to the taskbar/dock

#### Scenario: Maximize and restore
- **WHEN** the user clicks the maximize button on a non-maximized window
- **THEN** the window SHALL maximize to fill the screen
- **WHEN** the user clicks the maximize button on a maximized window
- **THEN** the window SHALL restore to its previous size and position

#### Scenario: Close
- **WHEN** the user clicks the close button
- **THEN** the application SHALL close

### Requirement: Titlebar menus
The titlebar SHALL include dropdown menus: File (with Quit), Window (with Dev Tools toggle in dev mode), and Help (with About link).

#### Scenario: File > Quit
- **WHEN** the user selects File > Quit from the titlebar menu
- **THEN** the application SHALL close

#### Scenario: Help > About
- **WHEN** the user selects Help > About
- **THEN** the application SHALL navigate to the About page

### Requirement: Window state persistence
The application SHALL remember window size and position across sessions using `tauri-plugin-window-state`.

#### Scenario: Window state restored
- **WHEN** the user resizes/moves the window and restarts the application
- **THEN** the window SHALL open at the previously saved size and position

### Requirement: Single instance enforcement
The application SHALL prevent multiple instances from running simultaneously using `tauri-plugin-single-instance`.

#### Scenario: Second instance attempted
- **WHEN** the user launches a second instance of the application
- **THEN** the existing instance SHALL be brought to focus and the second instance SHALL not open
