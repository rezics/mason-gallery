---
title: Rebuild product shell, theme, and management experience
status: active
created: 2026-07-04
completed:
supersededBy:
tags: [frontend, product-shell, settings, theme, cache-management, desktop]
---

## Why

Mason Gallery already has a capable masonry viewer, archive scanner, thumbnail pipeline, cache database, and platform abstraction. The problem is that those capabilities are not organized into a coherent product experience: full settings are hard to discover, management pages feel detached, the settings route has no clear way back to the gallery, some persisted desktop settings are not read back, and the current dark theme relies on a narrow rose-on-slate palette that does not suit a professional image viewer.

The intended outcome is a complete product-shell refactor, not a patch. The app should feel like a polished gallery workstation: image browsing remains the center, global navigation is explicit, settings and management are distinct and reachable, theme choices are attractive by default and user-customizable, and every visible option either works on the current platform or clearly explains why it is unavailable.

## Durable constraints & decisions

- (type) Theme configuration must separate mode, base preset, accent preset, and custom accent/custom tokens. Base preset controls surfaces and typography; accent controls action, selection, focus, and progress color.
- (type) Accent presets must include at least rose, blue, amber, emerald, violet, and custom. Rose remains the default so the existing Mason Gallery identity is preserved.
- (type) Base theme presets must include at least the current/default family, graphite, midnight, and paper/light-oriented choices. Presets must define both light and dark token sets where applicable.
- (test) Persisted theme, accent, cache cleanup, and password storage settings must survive desktop app restart/hydration through the platform service.
- (test) Theme token application must update CSS variables without requiring a page reload and must fall back to a valid preset if persisted values are unknown.
- (test) Generated foreground colors for preset accents and custom accent must maintain readable contrast for primary buttons, selected navigation items, focus rings, and progress indicators.
- (comment) Custom user color must be constrained through a small theme model instead of exposing raw global CSS editing; this keeps the app customizable without making broken UI states the default user path.
- (test) The settings route must always provide an explicit return path to the gallery, and direct routes such as `/settings/gallery` and `/cache` must be usable when opened directly.
- (test) Quick gallery controls and full preferences must not duplicate ownership ambiguously: quick panel owns frequent per-gallery controls, preferences owns durable app settings.
- (type) Product navigation should model top-level destinations explicitly: gallery, sources/library where needed, manage, preferences, and about. Route names should reflect those destinations rather than hiding management under archive settings.
- (test) Platform-specific controls must be hidden, disabled, or explained based on `PlatformCapabilities`; web must not show desktop-only cache/archive/password actions as if they work.
- (comment) Cache management is a first-class management surface, not merely an archive sub-setting, because folder thumbnails and archive extraction both contribute to storage behavior.
- (test) Startup cache cleanup must run from hydrated settings on desktop when the strategy is `auto-clean`, and must not run when the strategy is `keep-all`.
- (test) Existing gallery behavior must remain intact after shell refactor: opening folders, opening archives on desktop, folder sidebar filtering, grid jump, image lightbox, delete/reveal capability checks, and incremental refresh.
- (test) i18n must cover new visible labels in English and Chinese; no new hard-coded English labels may remain inside shared core pages/components.

## Tasks

## 1. Product Shell And Navigation

- [x] 1.1 Refactor `packages/core/src/components/Shell.tsx` to separate application chrome from routed page content and expose consistent top-level destinations.
- [x] 1.2 Replace the current ambiguous titlebar action wiring in `packages/core/src/components/MenuBar.tsx` with explicit navigation to gallery, manage, preferences, and about, while keeping folder open, refresh, sidebar, and desktop window controls ergonomic.
- [x] 1.3 Update `packages/desktop/src/components/Titlebar.tsx` and `packages/web/src/App.tsx` so desktop custom titlebar and web header share the same navigation semantics.
- [x] 1.4 Add a reusable page header/back pattern in core UI for routed pages that are not the gallery, including direct-route support and a clear return to the gallery.
- [x] 1.5 Rehome `/cache` under a clear management route such as `/manage/cache`, keeping a compatibility redirect or fallback for existing `/cache` links.

## 2. Preferences Information Architecture

- [ ] 2.1 Split the current `packages/core/src/pages/SettingsPage.tsx` into smaller category sections or components so appearance, gallery, files, archive/password, cache defaults, and advanced settings have distinct ownership.
- [x] 2.2 Rename user-facing "Settings" surfaces so quick gallery controls, preferences, and management are visually and semantically distinct.
- [x] 2.3 Replace the placeholder advanced section with useful, platform-aware controls or remove it until it has real purpose.
- [x] 2.4 Move cache-management entry points out of archive-only wording and make storage/cache management discoverable from the primary manage area.
- [x] 2.5 Ensure every preferences category has English and Chinese translations in `packages/core/src/i18n/en/index.ts` and `packages/core/src/i18n/zh/index.ts`.

## 3. Theme Presets And Custom Accent

- [x] 3.1 Extend `packages/core/src/types/platform.ts` and `packages/core/src/stores/settingsStore.ts` with theme preset, accent preset, custom accent, and any custom token shape needed for the first version.
- [x] 3.2 Introduce a theme token module in `packages/core/src` that defines preset tokens, accent tokens, validation/fallback behavior, and foreground derivation for custom accent colors.
- [x] 3.3 Refactor theme application in `Shell.tsx` or a dedicated theme hook so CSS variables are applied from the selected mode, preset, and accent instead of only toggling `.dark`.
- [x] 3.4 Update `packages/core/src/index.css` so base CSS variables are sane fallbacks and the new runtime tokens provide attractive light/dark surfaces without one-note rose or slate dominance.
- [x] 3.5 Build the Appearance preferences UI with base preset cards, accent swatches for rose/blue/amber/emerald/violet, custom accent input, reset action, and live preview.
- [x] 3.6 Keep custom background/surface/text token editing out of the first implementation unless the preset/accent model proves insufficient during review.

## 4. Management Center

- [x] 4.1 Refactor `packages/core/src/pages/CachePage.tsx` into a management page or subpage with clear summary metrics, source rows, pin/delete/customize actions, and empty states.
- [x] 4.2 Add route-level management navigation in core so cache/storage management is reachable without entering archive preferences first.
- [x] 4.3 Make cache actions safer with confirmation and clear affected scope for all, unpinned, per-source thumbnails, and per-source extracted files.
- [x] 4.4 Review per-source policy customization UI for clearer labels, validation feedback, and inherited/default state visibility.
- [x] 4.5 Add or revise i18n for all management labels, including cache, storage, source, pinned, override, inherited, and destructive actions.

## 5. Platform Settings Reliability

- [x] 5.1 Update `packages/desktop/src/adapters/TauriPlatformService.ts` so `loadSettings()` reads every setting that `settingsStore` persists, including theme, accent, cache cleanup strategy, and password storage mode.
- [x] 5.2 Update `packages/web/src/adapters/WebPlatformService.ts` only as needed for new settings shape compatibility and safe fallback from older localStorage payloads.
- [x] 5.3 Add a desktop startup side effect that calls `startupCacheCleanup` after settings hydration when cache cleanup is set to auto-clean.
- [x] 5.4 Ensure backend cache policy synchronization still happens after hydration and after preference edits, without racing against default settings.
- [x] 5.5 Preserve backward compatibility for existing persisted keys such as `thumbnailSizes` and `cachePolicy.thumbnailSizes`.

## 6. Core Viewer Regression Protection

- [x] 6.1 Verify `packages/core/src/pages/HomePage.tsx`, `WaterfallGrid.tsx`, `ImageViewer.tsx`, `FolderSidebar.tsx`, and `scanActions.ts` still work with the new shell and routes.
- [ ] 6.2 Add focused tests around settings hydration/fallback, theme token resolution, route accessibility, and platform capability gating.
- [x] 6.3 Run `bun run check` and fix any type, lint, or build issues introduced by the refactor.
- [ ] 6.4 Manually verify the web target and desktop target where available: first-run drop zone, folder scan, archive entry on desktop, preferences navigation, manage/cache navigation, dark theme, custom accent, and direct route reload.

## Out of scope

- Rewriting the Rust archive scanner, thumbnail queue, image server, or database schema unless required by the management UI.
- Replacing the masonry grid library or lightbox library.
- Building a fully open-ended CSS theme editor in the first pass.
- Adding cloud sync, accounts, tags, albums, ratings, search, or metadata editing.
- Changing release/update signing infrastructure beyond keeping the existing updater controls reachable and understandable.

## Implementation notes

- 2026-07-04: Product shell navigation, preferences/back routes, theme presets/custom accent, cache management routing/confirmations, desktop settings hydration, startup cache cleanup, and web/manual browser verification are implemented.
- Remaining unchecked items are follow-up hardening rather than blockers for the current product refactor: extracting SettingsPage into smaller components and adding a formal automated test harness to this repo.