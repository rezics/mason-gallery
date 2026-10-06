# Repository guidance

Mason Gallery ships a Tauri desktop app, an Astro website with a React gallery, and an npm CLI that serves the web build.

## Where to work

- `packages/core`: shared React UI, Zustand stores, platform types, and settings schema.
- `packages/desktop`: Tauri adapter and Rust backend (`src-tauri/src`).
- `packages/web`: Astro pages, React app, and File System Access adapter.
- `packages/cli`: local web server and npm entrypoint.
- `packages/i18n`: shared i18next resources (`src/locales/{en,zh-hans,zh-hant,ja}`).

## Commands

Use Bun and Go Task from the repository root. Desktop development also requires Rust and Tauri prerequisites. Task definitions live in `Taskfile.yml` and the package Taskfiles.

```sh
bun install
task dev:web
task dev:desktop
task build:web             # Astro site and React app
task build:desktop         # Generate icons and build Tauri
task build:cli             # Build web, then bundle CLI
task check                 # Biome, TypeScript projects, Astro checks
task test                  # Release scripts, core, and web behavior tests
task desktop:rust:format:check
task desktop:rust:clippy
task format
```

Choose checks appropriate to the change; documentation-only edits need reference and diff checks rather than application builds. Formatting rules live in `biome.json` and TypeScript settings in the package tsconfigs.

## Architecture constraints

- Keep shared behavior in core behind `PlatformService` (`packages/core/src/types/platform.ts`); native and browser operations belong in their platform adapters.
- Settings persist as one validated, versioned document through the platform service (`packages/core/src/persistence/settingsSchema.ts`). Zustand is runtime state.
- Desktop `library.db` in app data is durable; `cache.db` in app cache is disposable. Only cache storage may be rebuilt automatically. Cache clearing preserves source preferences, pinning, and policy overrides. Add ordered SQL migrations under `packages/desktop/src-tauri/src/migrations`.
- Archive passwords belong in Stronghold; SQLite stores vault-key references only.
- Web Dexie/IndexedDB persistence is best-effort and may be reset when incompatible.
- The viewer uses originals via `getImageUrl`; the grid uses thumbnails via `getThumbUrl`, with original fallback. Desktop `/thumb` only looks up existing thumbnails; generation belongs in the thumbnail pipeline.
- Keep shared translation keys and placeholders consistent across all supported locales. Public website content also lives in `packages/web/src/content/siteContent.ts`.

User instructions take precedence over skill guidelines. Repository skills under `.agents/skills` apply when their described task is relevant.
