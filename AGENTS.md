# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Mason Gallery is a masonry-layout image viewer shipped as three targets from a single monorepo: a Tauri desktop app, a browser SPA, and an npm CLI. All three consume a shared React component library (`packages/core`).

## Monorepo Layout

| Package | Purpose | Key Tech |
|---------|---------|----------|
| `packages/core` | Shared UI components, stores, types, i18n | React 19, MUI 7, Zustand, Wouter, typesafe-i18n |
| `packages/desktop` | Native desktop app | Tauri 2, Vite, Tailwind CSS 4 |
| `packages/web` | Browser SPA | Vite, Tailwind CSS 4, File System Access API |
| `packages/cli` | npm package that serves the web build locally | Node.js, sirv |

## Commands

```bash
bun install                # install dependencies

# Development
task dev:desktop           # Tauri desktop with hot reload (requires Rust + Tauri prereqs)
task dev:web               # Vite web dev server

# Production builds
task build:desktop         # Tauri production build
task build:web             # Web SPA build
task build:cli             # Builds web then bundles CLI

# Quality
task check                 # biome ci . && tsc --build
task format                # biome format --write .
task test                  # core and web behavior tests
```

Development requires [Go Task](https://taskfile.dev/installation/). Desktop development also requires Rust and [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/).

## Architecture

### Platform Abstraction

The core pattern is a `PlatformService` interface (`core/src/types/platform.ts`) that abstracts file system access, image scanning, settings persistence, and platform capabilities. Each target implements it:
- **Desktop**: `TauriPlatformService` — native file access via Tauri plugins, durable settings through Rust/SQLite, archive secrets through Tauri Stronghold
- **Web**: `WebPlatformService` — File System Access API, blob URLs, disposable Dexie/IndexedDB persistence

Entry points (`desktop/src/main.tsx`, `web/src/main.tsx`) create the appropriate service and pass it into the shared `Shell` component from core.

### Persistence Lifecycles

- Shared settings use the strict Zod schema and versioned envelope in `core/src/persistence/settingsSchema.ts`. Platforms load and save one complete document; Zustand remains runtime state only.
- Desktop durable data lives in `library.db` under Tauri's app-data directory. Desktop cache metadata lives in a separate `cache.db` under Tauri's app-cache directory. Both use ordered `rusqlite_migration` SQL files; only the cache database may be rebuilt automatically.
- Source pinning and per-source policy overrides are durable even when cache rows are discarded. Archive passwords never enter SQLite: `library.db` stores only Stronghold vault-key references.
- Web settings and File System Access directory handles live in Dexie/IndexedDB. The web database is intentionally best-effort and is rebuilt wholesale when its schema or data is incompatible.

### Rust Backend (Desktop)

`packages/desktop/src-tauri/src/commands.rs` exposes two Tauri commands:
- `scan_directory` — walks directories with `walkdir`, extracts image dimensions in parallel with `rayon`, emits results in batches via events
- `delete_to_trash` — moves files to system trash

### State Management

Zustand stores in `core/src/stores/`:
- `useAppStore` — folder selection, UI toggles
- `useSettingsStore` — image formats, sort method, language, column breakpoints (persisted as one validated document via the platform service)
- `useViewerStore` — current image batch and viewer state

### Routing

Hash-based routing via `wouter`: `/` (image grid), `/about` (about page).

### i18n

`typesafe-i18n` with English and Traditional Chinese (`core/src/i18n/{en,zh}/`).

## Code Style

- **Formatter/Linter**: Biome — 2-space indent, double quotes, semicolons
- **TypeScript**: Strict mode, ES2022 target, bundler module resolution
- **Path alias**: `@/` maps to `packages/core/src/` in both Vite configs and tsconfigs
