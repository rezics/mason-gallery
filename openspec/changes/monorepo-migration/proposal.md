## Why

WViewer v2.0 is a Tauri desktop app — tightly coupled to native APIs for filesystem access, window management, and auto-updates. This means the core experience (drag a folder, see images in a waterfall grid) is locked behind a ~10MB desktop download. Meanwhile, the same masonry layout, image rendering, and UI could run entirely in a browser with zero install — reaching users who just want a quick preview tool without committing to an app install.

A monorepo split enables:
1. **Independent web release** — a static site (or npm-installable local server) that handles drag-and-drop folder browsing with waterfall image preview, powered by browser-native File System Access API and `image-dimensions` for header-only size extraction.
2. **Independent desktop release** — retains full Tauri-powered features (deep directory scanning via Rust, delete-to-trash, auto-update, window management) with room for future extensions.
3. **Shared core** — UI components, stores, types, and i18n live in one place, evolve once, ship to both targets.
4. **npm package distribution** — a `@wviewer/cli` package that, once installed, starts a local web server serving the static web build — a simple wrapper for quick local use.

## What Changes

- **BREAKING**: Restructure from single-package to monorepo using Bun workspaces
- **BREAKING**: Extract platform-agnostic UI, stores, types, and i18n into `packages/core`
- **NEW**: Introduce `PlatformService` abstraction layer — an interface contract that decouples all components from direct Tauri API imports
- **NEW**: `packages/desktop` — Tauri app with `TauriPlatformService` adapter implementing the full feature set
- **NEW**: `packages/web` — Vite-built static SPA with `WebPlatformService` adapter using File System Access API + `image-dimensions` library
- **NEW**: `packages/cli` — Lightweight Node.js package that serves the web build locally via a built-in HTTP server (e.g., `npx @wviewer/cli` or `wviewer` after global install)
- Replace all direct `@tauri-apps/*` imports in shared components with `PlatformService` calls
- Add `image-dimensions` (sindresorhus, ~18.7KB, zero deps) as the web adapter's image size extraction strategy
- Components conditionally render based on `PlatformService.capabilities` (e.g., web hides delete button, titlebar, update checker)

## Capabilities

### New Capabilities

- `platform-abstraction`: `PlatformService` interface + React context provider, enabling any component to call platform operations without knowing whether it's Tauri or browser
- `web-adapter`: Browser-native implementation — File System Access API for folder scanning, `URL.createObjectURL()` for image URLs, `image-dimensions` for size extraction, `localStorage` for settings persistence
- `desktop-adapter`: Tauri implementation wrapping existing `invoke()`, `convertFileSrc()`, `plugin-store`, `plugin-dialog` calls behind the `PlatformService` interface
- `web-app`: Standalone Vite SPA build — drag-drop folder, waterfall preview, lightbox viewing, settings (no delete, no titlebar, no auto-update)
- `cli-server`: Node.js CLI package (`@wviewer/cli`) — `serve` command starts a local HTTP server hosting the web build, opens the browser automatically
- `monorepo-infra`: Bun workspace configuration, shared tsconfig, per-package build scripts, unified `check` command

### Modified Capabilities

- `waterfall-view`: Refactored to use `PlatformService.getImageUrl()` instead of direct `convertFileSrc()`
- `image-viewer`: Refactored to use `PlatformService.deleteFile()` (with capability check) instead of direct `invoke("delete_to_trash")`
- `folder-management`: DropZone refactored — desktop uses Tauri drag-drop events + native dialog, web uses HTML5 drag-drop + File System Access API, both via `PlatformService`
- `settings-panel`: `useSettingsStore` hydration uses `PlatformService.loadSettings()` / `PlatformService.saveSettings()` instead of direct `plugin-store`
- `state-management`: Stores become platform-agnostic — no direct Tauri imports
- `app-shell`: Titlebar and UpdateChecker become desktop-only components, conditionally rendered via `capabilities.hasCustomTitlebar` and `capabilities.canAutoUpdate`

## Impact

- **Codebase**: Major restructure — all source moves from `src/` to `packages/*/src/`. No logic is deleted, only relocated and abstracted.
- **Dependencies**: `packages/core` has zero platform dependencies. `packages/desktop` retains all `@tauri-apps/*` deps. `packages/web` adds `image-dimensions`. `packages/cli` adds `sirv` (or similar static server).
- **Build system**: Each package has its own `vite.config.ts`. Desktop build: `tauri build`. Web build: `vite build`. CLI: bundles the web dist + server script.
- **CI/CD**: Existing GitHub Actions workflows need updating — matrix now includes web build + deploy (e.g., GitHub Pages / Vercel) alongside desktop release.
- **Binary size**: Desktop unchanged (~5-10MB). Web build expected ~200-400KB gzipped (React + MUI + masonic + image-dimensions).
- **npm distribution**: `@wviewer/cli` published to npm. Users run `npx @wviewer/cli` for instant local web viewer.
