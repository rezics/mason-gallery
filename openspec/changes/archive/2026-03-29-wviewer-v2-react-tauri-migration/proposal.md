## Why

WViewer v1.4.0 is built on Vue 3 + Quasar + Electron — a stack that has served well but now carries significant weight: Electron bundles a full Chromium instance (~150MB+), the Quasar framework couples UI tightly to Vue idioms making customization rigid, and the Node.js main process limits performance for filesystem-heavy operations like recursive directory traversal and image metadata extraction. Migrating to React + Tauri v2 delivers a dramatically smaller binary (~5-10MB), native Rust performance for file I/O, stronger security via Tauri's sandboxed architecture, and access to the larger React ecosystem for UI innovation. Now is the right time because Tauri v2 has stabilized, and the codebase is at a natural breakpoint between archived versions.

## What Changes

- **BREAKING**: Complete rewrite from Vue 3 / Quasar / Electron to React 19 / Tauri v2
- **BREAKING**: Replace Pinia state management with Zustand
- **BREAKING**: Replace Vue Router with wouter
- **BREAKING**: Replace electron-store with tauri-plugin-store
- Replace Node.js filesystem operations with Rust-native directory traversal (walkdir + image crates) for 10x+ performance improvement
- Replace Electron's custom `atom://` protocol with Tauri's `asset://` protocol for local file serving
- Adopt MUI as the primary UI framework with shadcn/ui for supplementary dynamic components
- Implement custom titlebar using MUI (frameless window)
- Adopt Tailwind CSS v4 for utility styling
- Adopt typesafe-i18n for type-safe internationalization (English + Chinese)
- Adopt masonic for virtualized waterfall/masonry layout (replaces vue-waterfall-plugin-next)
- Adopt yet-another-react-lightbox for image viewing (replaces photoswipe/bigger-picture/viewerjs)
- Set up Biome for linting and formatting (replaces ESLint + Prettier)
- Set up GitHub Actions CI (PR checks + cross-platform release workflow)
- Set up Renovate for automated dependency updates
- Add auto-update support via tauri-plugin-updater

## Capabilities

### New Capabilities

- `project-scaffold`: Tauri v2 + React 19 + Vite project structure, Bun package manager, Biome config, TypeScript config, Tailwind CSS v4 setup
- `rust-file-engine`: Rust-side directory traversal, image metadata extraction, file operations (delete-to-trash), and Tauri command API exposed to frontend
- `asset-protocol`: Tauri asset:// protocol configuration for serving local images/videos to the webview
- `app-shell`: Frameless window with MUI custom titlebar, window state persistence, single-instance enforcement, drag regions
- `waterfall-view`: Virtualized masonry/waterfall image grid using masonic with responsive breakpoints, pagination, and sort controls
- `image-viewer`: Full-screen lightbox image/video viewing using yet-another-react-lightbox with zoom, pan, and navigation
- `settings-panel`: Settings UI and persistence via tauri-plugin-store — image formats, video formats, sort method, per-page count, viewer preferences, language selection
- `folder-management`: Folder selection via native dialog (tauri-plugin-dialog), multi-folder support, drag-and-drop folder opening
- `i18n`: Type-safe internationalization with typesafe-i18n for English and Chinese locales
- `state-management`: Zustand stores for application state — viewer state, settings, folder/image data
- `routing`: Client-side routing with wouter — main view, settings, about page
- `ci-cd`: GitHub Actions workflows for PR checks (Biome, tsc, clippy, fmt, build) and cross-platform release (Windows/macOS/Linux), Renovate config, auto-updater integration

### Modified Capabilities

_(No existing capabilities — this is a greenfield rewrite)_

## Impact

- **Codebase**: Full replacement — no Vue/Quasar/Electron code carries forward. Architecture and feature knowledge from v1.4.0 informs the rewrite.
- **Dependencies**: Entirely new dependency tree. Frontend: ~15 npm packages. Backend: ~10 Rust crates. Net reduction in total dependency weight.
- **Build system**: Vite (retained) + Tauri CLI (replaces Quasar CLI + electron-builder). Package manager switches from npm to Bun.
- **Binary size**: Expected reduction from ~150MB (Electron) to ~5-10MB (Tauri).
- **Platform support**: Windows, macOS (x64 + ARM), Linux (x64 + ARM) — same coverage, better native integration.
- **File protocol**: `atom://` → `asset://` — all image/video source URLs change format.
- **Storage**: electron-store JSON → tauri-plugin-store JSON — data format similar but migration path needed if upgrading existing installs.
- **CI/CD**: New GitHub Actions workflows replace any existing build scripts.
