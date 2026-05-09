## Context

Mason Gallery ships desktop, web, and CLI targets from a monorepo, with most UI living in `packages/core`. The current shared shell, menus, settings surfaces, dialogs, and desktop titlebar rely on MUI and Emotion, while Tailwind CSS v4 is already installed and used by the waterfall grid. The existing settings drawer has grown into a dense control surface that mixes frequent gallery controls with rare archive/cache policy settings.

The desired direction is to fully leave MUI behind, use Tailwind CSS and shadcn/ui with the Luma style, choose Base UI primitives for shadcn components, preserve the existing brand color, add real light/dark/system theming, and split settings into a quick right-side panel plus dedicated settings routes.

## Goals / Non-Goals

**Goals:**

- Remove all runtime use of MUI, Emotion, and MUI icon components.
- Establish a complete shadcn-compatible theme contract for light and dark themes.
- Use shadcn/ui components generated for Base UI primitives, not Radix primitives.
- Preserve Mason Gallery's brand color `#f4606c` as the primary accent.
- Add a persisted `system` / `light` / `dark` theme preference.
- Convert the existing right-side settings drawer into a quick gallery panel for frequent, contextual controls.
- Move complex and low-frequency settings into settings routes.
- Keep image browsing visually content-first and avoid making the grid area visually heavier.
- Preserve existing settings persistence keys and platform behaviors unless a spec explicitly changes them.

**Non-Goals:**

- Reworking the Rust scan engine, thumbnail protocol, or archive cache semantics.
- Changing the masonry virtualization library or grid placement algorithm.
- Redesigning Mason Gallery as a marketing-style app or landing page.
- Replacing the current hash-based routing model.
- Implementing multi-window, workspace, or account-level preferences.

## Decisions

### Use Base UI as the shadcn primitive foundation

Use shadcn/ui components generated for Base UI primitives. This keeps the new component layer aligned with the requested direction and avoids mixing primitive systems during the migration.

Alternatives considered:

- Radix-backed shadcn components: mature and widely documented, but not the requested primitive base.
- Headless custom components: maximum control, but too much accessibility and keyboard behavior to rebuild safely.

### Own the component source in `packages/core`

Place shared UI primitives under `packages/core/src/components/ui` and compose app-specific surfaces from them. Avoid importing generated components directly from target packages so desktop and web share the same design language.

Alternatives considered:

- Per-target component generation: creates drift between desktop and web.
- A separate package for UI primitives: reasonable later, but unnecessary overhead while all shared UI already lives in core.

### Define theme through Tailwind/shadcn CSS variables

Move the global theme from MUI's `createTheme` to CSS variables compatible with shadcn's token model. Define both light and dark token sets in `packages/core/src/index.css`, map brand color `#f4606c` to the primary accent, and expose a root class or data attribute that switches active theme.

Alternatives considered:

- Tailwind utility classes without semantic tokens: fast initially, but makes future theme tuning expensive.
- Keeping MUI ThemeProvider only for theme: violates the goal of fully removing MUI and Emotion.

### Treat the image canvas differently from chrome

Apply Luma's soft surfaces, rounded geometry, and shadows to chrome, menus, panels, forms, and dialogs. Keep the waterfall grid area neutral and low-chrome so image content remains dominant.

Alternatives considered:

- Apply Luma surfaces everywhere: visually cohesive but risks making image browsing feel decorative.
- Minimal flat UI everywhere: efficient, but loses the value of adopting a named shadcn style.

### Split settings by frequency

The right-side overlay becomes a quick gallery panel. Complex settings move to `/settings` and nested category routes such as `/settings/appearance`, `/settings/gallery`, `/settings/files`, `/settings/archive`, `/settings/cache`, and `/settings/advanced`.

Alternatives considered:

- Keep a single settings drawer: preserves current behavior but keeps compounding complexity.
- Move every setting to routes and remove the overlay: cleaner IA, but loses fast in-context gallery adjustments.

### Preserve persisted setting keys where possible

Existing keys such as `formats`, `sortMethod`, `pageSize`, `breakpoints`, `showGridPosition`, `cachePolicy`, `thumbnailSizes`, and `folderThumbnails` should remain stable. Add a new key for theme preference rather than renaming unrelated settings.

Alternatives considered:

- Rename settings around the new IA: cleaner naming, but creates migration risk without user-facing value.

## Risks / Trade-offs

- Base UI-backed shadcn examples may be less common than Radix-backed examples -> Keep the generated primitive layer small at first and add components only when needed.
- A full MUI removal can create a large diff -> Migrate by surface area: foundation, shell chrome, dialogs, quick panel, settings routes, then dependency cleanup.
- Light theme can expose contrast issues in an app historically designed dark-first -> Require visual verification for both themes on desktop and web.
- Settings route expansion can make simple preferences feel buried -> Keep a visible quick panel link to the relevant full settings category.
- Luma styling can compete with images -> Use neutral grid backgrounds and avoid decorative surfaces around the masonry canvas.
- Existing active work in `thumbnail-scan-perf` may touch adjacent gallery/cache code -> Avoid changing scan protocol or backend behavior in this change and resolve UI-only conflicts carefully.

## Migration Plan

1. Add shadcn/Base UI dependencies, Tailwind utility helpers, and local `components/ui` primitives.
2. Define complete light and dark theme tokens in shared CSS and add theme preference state/persistence.
3. Replace shell-level MUI theme, baseline, top menus, titlebar controls, and icon usage.
4. Replace reusable dialogs and notification surfaces.
5. Convert the current settings drawer into the quick gallery panel.
6. Add settings route layout and category pages, moving existing controls without changing persisted keys.
7. Replace remaining MUI usage in pages and viewer controls.
8. Remove MUI and Emotion dependencies from all packages.
9. Run typecheck/build validation and visually verify desktop and web in both themes.

Rollback is dependency-level: because this is a cross-cutting UI migration, rollback should happen by reverting the change before release rather than trying to support both MUI and shadcn UI systems at runtime.

## Open Questions

- Which exact quick panel controls should be visible by default versus hidden behind an "advanced view" affordance?
- Should the app default theme be `system` for new installs, or keep the current dark-first feel by defaulting to `dark`?
- Should settings categories be nested routes only, or should `/settings` render a dashboard-style overview with category navigation?
