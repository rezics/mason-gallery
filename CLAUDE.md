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

`packages/desktop/src-tauri/src/commands.rs` exposes two Tauri commands:
- `scan_directory` — walks directories with `walkdir`, extracts image dimensions in parallel with `rayon`, emits results in batches via events
- `delete_to_trash` — moves files to system trash

### State Management

Zustand stores in `core/src/stores/`:
- `useAppStore` — folder selection, UI toggles
- `useSettingsStore` — image formats, sort method, language, column breakpoints (persisted via platform service)
- `useViewerStore` — current image batch and viewer state

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
