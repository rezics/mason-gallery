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
bun run dev:desktop        # Tauri desktop with hot reload (requires Rust + Tauri prereqs)
bun run dev:web            # Vite web dev server

# Production builds
bun run build:desktop      # Tauri production build
bun run build:web          # Web SPA build
bun run build:cli          # Builds web then bundles CLI

# Quality
bun run check              # biome ci . && tsc --build
bun run format             # biome format --write .
```

Desktop development requires Rust and [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/).

## Architecture

### Platform Abstraction

The core pattern is a `PlatformService` interface (`core/src/types/platform.ts`) that abstracts file system access, image scanning, settings persistence, and platform capabilities. Each target implements it:
- **Desktop**: `TauriPlatformService` — native file access via Tauri plugins, settings via `@tauri-apps/plugin-store`
- **Web**: `WebPlatformService` — File System Access API, blob URLs, localStorage

Entry points (`desktop/src/main.tsx`, `web/src/main.tsx`) create the appropriate service and pass it into the shared `Shell` component from core.

### Rust Backend (Desktop)

The backend is layered as `commands` → `services` → `database` + local Axum HTTP server.

**Service layer** (`src-tauri/src/services/`):
- `source_service` — unified CRUD over `sources` table (archive + folder, keyed by `origin_path`), migration detection via reverse path-segment scoring, identity-segment computation
- `archive_service` — opens archive readers (delegates to `archive.rs`), lists entries, extracts entries to disk; returns `ExtractResult` variants (cached / freshly extracted / tempfile-for-no-cache)
- `thumbnail_service` — resolves `(sourceHash, entryHash, width)` to an on-disk thumbnail path (lookup only) and generates thumbnails during archive scans
- `image_service` — resolves `archive:///` URIs and bare filesystem paths to bytes, enforcing the per-source `CachePolicy` (extracted `no-cache`/`lru-capped`/`unlimited`, thumbnails retain mode). Guards concurrent extraction of the same entry behind `ExtractLocks = Arc<DashMap<String, Arc<tokio::sync::Mutex<()>>>>` so simultaneous viewer opens trigger exactly one extraction.

**SQLite schema** (`src-tauri/src/database.rs`): `sources` (unified), `thumbnails` (per width), `extracted` (per entry with `last_accessed` for LRU), `passwords` (encrypted archive unlocks), `schema_meta` (version marker — on legacy-schema detection, the old cache dir is wiped and recreated).

**Local Axum server** (`src-tauri/src/server.rs`): serves two split endpoints:
- `GET /image` — **always** returns originals. `image_handler` delegates to `image_service::resolve_original`.
- `GET /thumb?source=...&entry=...&w=...` — thumbnail lookup only (no generation); returns 404 on miss.

Tauri commands (`src-tauri/src/commands.rs` + `archive_commands.rs`):
- `scan_directory`, `scan_archive` — emit batches over events; scan_archive generates thumbnails per configured width via `thumbnail_service`
- `clear_thumbnails(sourceId?)`, `clear_extracted(sourceId?)` — split cache-clear (replaces old `clear_cache`)
- `check_migration`, `confirm_migration`, `pin_cache`, `set_cache_policy`, `set_source_policy`, `get_cache_stats`, `unlock_archive`, `delete_to_trash`, etc.

### Split Delivery Pipelines (Frontend)

`PlatformService` exposes **two** URL builders that the UI picks between based on intent:
- `getImageUrl(source)` — full-resolution original; used by `ImageViewer`
- `getThumbUrl(thumbId)` — small pre-generated thumbnail; `thumbId` is an opaque `mg-thumb:///<sourceHash>/<entryHash>?w=<width>` URI. Used by `WaterfallGrid` via a multi-width `srcSet`.

Scan batches include `thumbnails?: Thumbnail[]` (array of widths) on each image. The grid constructs `srcSet`/`sizes` from this array; the viewer ignores it and calls `getImageUrl` directly. This ensures no thumbnail can ever be served in the viewer, and high-DPI displays pick the appropriate thumbnail width automatically.

### State Management

Zustand stores in `core/src/stores/`:
- `useAppStore` — folder selection, UI toggles, archive migration/password prompts, directory tree state
- `useSettingsStore` — image formats, sort method, language, column breakpoints, `cachePolicy`, `thumbnailSizes`, password storage mode (persisted via platform service; `setCachePolicy` also syncs to the Rust backend)
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
