## ADDED Requirements

### Requirement: Tailwind shadcn theme foundation
The application SHALL define its shared visual theme through Tailwind CSS v4 and shadcn-compatible CSS variables instead of MUI theme APIs.

#### Scenario: Shared theme tokens load
- **WHEN** the application shell renders in desktop or web
- **THEN** the document SHALL have access to semantic tokens for background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, and radius
- **AND** these tokens SHALL be usable by shared core components through Tailwind classes.

### Requirement: Luma Base UI component system
The application SHALL use shadcn/ui components generated for Base UI primitives and the Luma style as the foundation for shared controls.

#### Scenario: Base UI primitives used
- **WHEN** a new shared button, menu, select, dialog, sheet, tooltip, slider, switch, or form control is added for this change
- **THEN** it SHALL be implemented through the local shadcn/Base UI component layer
- **AND** it SHALL NOT import Radix primitives.

### Requirement: Brand color preservation
The application SHALL preserve Mason Gallery's brand color `#f4606c` as the primary accent in both light and dark themes.

#### Scenario: Primary token uses brand color
- **WHEN** either theme is active
- **THEN** primary actions, focus accents, and selected states SHALL use a token derived from `#f4606c`
- **AND** primary foreground text SHALL meet accessible contrast for the active theme.

### Requirement: Light dark and system theme preference
The application SHALL provide a persisted theme preference with `system`, `light`, and `dark` options.

#### Scenario: User selects dark theme
- **WHEN** the user selects `dark` in appearance settings
- **THEN** the dark theme SHALL apply immediately
- **AND** the preference SHALL persist across app restarts.

#### Scenario: User selects system theme
- **WHEN** the user selects `system`
- **THEN** the active theme SHALL follow the operating system or browser color scheme preference
- **AND** changes to the system preference SHALL update the active theme without requiring restart.

### Requirement: MUI dependency removal
The application SHALL NOT use MUI or Emotion packages for runtime UI after this change.

#### Scenario: No MUI imports remain
- **WHEN** the source tree is searched after implementation
- **THEN** no application source file SHALL import `@mui/material`, `@mui/icons-material`, `@emotion/react`, or `@emotion/styled`.

#### Scenario: Package dependencies removed
- **WHEN** package manifests are inspected after implementation
- **THEN** MUI and Emotion packages SHALL NOT appear as runtime, peer, or dev dependencies unless required only by an unrelated third-party tool.

### Requirement: Content first image canvas
The Luma styling SHALL apply to app chrome and controls without adding decorative visual weight around the waterfall image canvas.

#### Scenario: Waterfall area remains neutral
- **WHEN** the user views a loaded gallery
- **THEN** menus, panels, and dialogs SHALL use the Luma theme language
- **AND** the masonry grid viewport SHALL remain neutral and content-first, with image tiles as the dominant visual element.
