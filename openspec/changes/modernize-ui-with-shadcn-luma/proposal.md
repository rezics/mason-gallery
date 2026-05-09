## Why

Mason Gallery's shared UI is currently anchored to MUI's runtime theme, components, and icon package, which makes the app carry two competing styling systems while Tailwind is already present in the workspace. Moving to Tailwind CSS with shadcn/ui's Luma style and Base UI primitives gives the project an owned component layer, cleaner cross-target styling, and room to reorganize the increasingly crowded settings experience.

## What Changes

- **BREAKING**: Remove MUI and Emotion as application UI dependencies across core, desktop, and web targets.
- Introduce a Tailwind CSS v4 design system using shadcn/ui components generated for Base UI primitives and the Luma style.
- Define a complete shadcn theme token contract for light and dark modes while preserving Mason Gallery's brand color `#f4606c` as the primary brand accent.
- Add a persisted theme preference with `system`, `light`, and `dark` options.
- Replace MUI icons with the shadcn-aligned icon set used by the new UI layer.
- Replace the current settings drawer with a right-side quick panel focused on gallery-session controls and frequent waterfall-view adjustments.
- Move most persistent settings into dedicated settings routes instead of keeping every control in the overlay drawer.
- Keep the image canvas content-first: the new Luma styling should shape chrome, panels, menus, and dialogs without making the waterfall grid visually heavy.
- Preserve existing platform behavior, settings persistence, routing model, archive/cache settings semantics, and masonry rendering behavior unless explicitly changed by the specs below.

## Capabilities

### New Capabilities

- `ui-theme-system`: Defines the Tailwind/shadcn Luma theme contract, Base UI component foundation, supported light/dark/system modes, and MUI removal expectations.
- `settings-routes`: Defines the dedicated settings route structure and navigation behavior for settings categories.
- `quick-gallery-panel`: Defines the right-side quick panel for frequent gallery and waterfall-view controls.

### Modified Capabilities

- `settings-panel`: Replace the all-in-one MUI settings drawer requirement with split responsibilities between quick controls and dedicated settings pages while preserving existing setting semantics.
- `routing`: Add settings routes and update the settings access model so settings can be route-based instead of only an overlay.
- `app-shell`: Remove MUI AppBar requirements from shell/titlebar behavior and require the shell chrome to use the new Tailwind/shadcn UI foundation.

## Impact

- Affected packages:
  - `packages/core`: shared theme CSS, shadcn/Base UI components, shell, menus, dialogs, settings UI, routes, and pages.
  - `packages/desktop`: custom titlebar and update notification UI.
  - `packages/web`: dependency cleanup and compatibility with shared core UI.
  - `packages/cli`: indirectly affected through the web build output.
- Dependency changes:
  - Remove `@mui/material`, `@mui/icons-material`, `@emotion/react`, and `@emotion/styled`.
  - Add shadcn/Base UI related runtime dependencies, Tailwind utility helpers, and the icon package selected for the new component layer.
- Persistence changes:
  - Add a persisted theme preference.
  - Preserve existing persisted settings keys unless a later migration is explicitly specified.
- OpenSpec coordination:
  - This change should avoid modifying scan performance behavior owned by the active `thumbnail-scan-perf` change.
