# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

The backend is layered as `commands` → `services` → `database` + local Axum HTTP server.

**Service layer** (`src-tauri/src/services/`):
- `source_service` — unified CRUD over `sources` table (archive + folder, keyed by `origin_path`), migration detection via reverse path-segment scoring, identity-segment computation
- `archive_service` — opens archive readers (delegates to `archive.rs`), lists entries, extracts entries to disk; returns `ExtractResult` variants (cached / freshly extracted / tempfile-for-no-cache)
- `thumbnail_service` — resolves `(sourceHash, entryHash, width)` to an on-disk thumbnail path (lookup only) and generates thumbnails during archive scans
- `image_service` — resolves `archive:///` URIs and bare filesystem paths to bytes, enforcing the per-source `CachePolicy` (extracted `no-cache`/`lru-capped`/`unlimited`, thumbnails retain mode). Guards concurrent extraction of the same entry behind `ExtractLocks = Arc<DashMap<String, Arc<tokio::sync::Mutex<()>>>>` so simultaneous viewer opens trigger exactly one extraction.

**SQLite schemas** (`src-tauri/src/database.rs` + `src-tauri/src/migrations/`): durable `library.db` contains the versioned settings document, source preferences, and Stronghold secret references. Disposable `cache.db` contains `sources`, `thumbnails` (per width), and `extracted` (per entry with `last_accessed` for LRU). Migrations use SQLite `user_version`; a cache migration failure rebuilds only explicit cache artifacts, while a durable migration failure preserves the database and aborts startup.

**Local Axum server** (`src-tauri/src/server.rs`): serves two split endpoints:
- `GET /image` — **always** returns originals. `image_handler` delegates to `image_service::resolve_original`.
- `GET /thumb?source=...&entry=...&w=...` — thumbnail lookup only (no generation); returns 404 on miss.

Tauri commands (`src-tauri/src/commands.rs` + `archive_commands.rs`):
- `scan_directory`, `scan_archive` — emit batches over events. `scan_directory` now inline-expands archives it encounters during `walkdir`: unlocked archives stream their entries (with thumbnails) into the same `images:batch` stream at the archive's sort position; locked archives emit a single `locked: true` WImage placeholder keyed by `archive:///<path>` for click-to-unlock UX.
- `request_thumbnail`, `cancel_thumbnail` — on-demand thumbnail generation for the lazy folder pipeline; results delivered via the `images:thumbnails` event.
- `clear_thumbnails(sourceId?)`, `clear_extracted(sourceId?)` — split cache-clear (replaces old `clear_cache`)
- `check_migration`, `confirm_migration`, `pin_cache`, `set_cache_policy`, `set_source_policy`, `get_cache_stats`, `unlock_archive`, `delete_to_trash`, etc.

**Lazy folder-thumbnail pipeline** (`folderThumbnails: "off" | "lazy"` setting): When `"lazy"`, grid tiles use an IntersectionObserver + 150ms dwell gate to call `request_thumbnail(sourceId, entryPath)`. A long-running tokio task drains a LIFO queue with a 4-permit semaphore, runs generation on `spawn_blocking`, and emits `images:thumbnails` (skipped on cancel). The frontend patches the specific entry in-place via `useViewerStore.patchThumbnails`, so the positioner never recomputes. Requests below `cachePolicy.extracted.minFileSize` return `skipped: true` and are remembered in `skippedThumbs` to suppress re-requests. Archives (which always get thumbnails at scan time) and loose files with pre-existing thumbnails are gated out of the lazy request path.

### Split Delivery Pipelines (Frontend)

`PlatformService` exposes **two** URL builders that the UI picks between based on intent:
- `getImageUrl(source)` — full-resolution original; used by `ImageViewer`
- `getThumbUrl(thumbId)` — small pre-generated thumbnail; `thumbId` is an opaque `mg-thumb:///<sourceHash>/<entryHash>?w=<width>` URI. Used by `WaterfallGrid` via a multi-width `srcSet`.

Scan batches include `thumbnails?: Thumbnail[]` (array of widths) on each image. The grid constructs `srcSet`/`sizes` from this array; the viewer ignores it and calls `getImageUrl` directly. This ensures no thumbnail can ever be served in the viewer, and high-DPI displays pick the appropriate thumbnail width automatically.

### State Management

Zustand stores in `core/src/stores/`:
- `useAppStore` — folder selection, UI toggles, archive migration/password prompts, directory tree state
- `useSettingsStore` — image formats, sort method, language, column breakpoints, `cachePolicy`, derived `thumbnailSizes`, password storage mode (persisted as one versioned document; `setCachePolicy` also syncs to the Rust backend)
- `useViewerStore` — current image batch, scan progress, viewer open state, relayout signaling

### Routing

Hash-based routing via `wouter`: `/` (image grid), `/about` (about page).

### i18n

`typesafe-i18n` with English and Traditional Chinese (`core/src/i18n/{en,zh}/`).

## Code Style

- **Formatter/Linter**: Biome — 2-space indent, double quotes, semicolons
- **TypeScript**: Strict mode, ES2022 target, bundler module resolution
- **Path alias**: `@/` maps to `packages/core/src/` in both Vite configs and tsconfigs

## OpenSpec Workflow

The project uses OpenSpec (`openspec/`) for spec-driven development. Specs live in `openspec/specs/`, changes in `openspec/changes/`. Use the `/opsx:propose`, `/opsx:apply`, `/opsx:explore`, and `/opsx:archive` slash commands to drive the workflow.
