## Context

WViewer v1.4.0 is a desktop image/video viewer built with Vue 3 + Quasar + Electron. It provides waterfall (masonry) layout for browsing images from local folders, full-screen image viewing with multiple viewer backends (photoswipe, bigger-picture, viewerjs), settings persistence via electron-store, and a frameless custom-titlebar window. The app supports English and Chinese, pagination, sorting (name/time asc/desc), drag-and-drop folder opening, and delete-to-trash.

The Electron main process handles filesystem traversal (sync and async with pagination), image dimension extraction, native dialogs, and IPC for store operations. The frontend uses Pinia for state, Vue Router for routing, and Quasar components for UI. The app uses a custom `atom://` protocol to serve local files to the renderer.

This is an open-source project targeting Windows, macOS, and Linux.

## Goals / Non-Goals

**Goals:**
- Full feature parity with v1.4.0 on the new stack
- Dramatically smaller binary size (Electron ~150MB → Tauri ~5-10MB)
- Significantly faster directory traversal and image metadata extraction via Rust
- Modern, maintainable React codebase with type-safe state and i18n
- Professional CI/CD pipeline with cross-platform releases and auto-update
- MUI-primary UI with shadcn/ui accents for a polished, dynamic look
- Virtualized rendering for large image collections (thousands of images)

**Non-Goals:**
- Mobile or web deployment (desktop only via Tauri)
- Cloud storage or remote image sources (local filesystem only)
- Image editing capabilities
- Database-backed image indexing or search (may come later)
- macOS App Store or Windows Store distribution (GitHub Releases only)
- Video playback in the viewer (video format support was commented out in v1.4.0; defer to future)

## Decisions

### D1: Rust-native file engine over tauri-plugin-fs for traversal

**Decision:** Implement directory traversal, image metadata extraction, and file operations as Rust Tauri commands, not via tauri-plugin-fs from the frontend.

**Rationale:** The old app's Node.js traversal was a bottleneck — synchronous `fs.readdirSync` blocked the main process, and even the async version used `promisify(imageSize)` sequentially. Rust's `walkdir` crate with `rayon` for parallel image dimension reads can achieve 10-50x speedup. Tauri commands are invoked via `invoke()` from the frontend, keeping the API clean.

**Alternatives considered:**
- *tauri-plugin-fs from frontend*: Simpler but requires many IPC round-trips for recursive traversal; image dimension extraction would need a separate solution (no `image-size` equivalent in JS without Node.js).
- *Hybrid (Rust traversal + JS metadata)*: Splits logic across languages unnecessarily.

**Rust crates:**
- `walkdir` — recursive directory traversal
- `image` — image dimension extraction (header-only, fast)
- `rayon` — parallel processing for large directories
- `trash` — cross-platform delete-to-trash
- `serde` / `serde_json` — serialization for Tauri commands
- `natord` — natural sort order for filenames

### D2: Tauri asset protocol for local file serving

**Decision:** Use Tauri's built-in `asset://` protocol (via asset scope configuration) to serve local images to the webview, replacing Electron's custom `atom://` protocol.

**Rationale:** Tauri v2 provides `asset://localhost/<encoded-path>` with configurable scope permissions. This is the official, security-audited approach. No custom protocol registration needed.

**Configuration:** In `tauri.conf.json`, define an asset scope that permits access to user-selected directories. Use `tauri-plugin-persisted-scope` to remember permissions across sessions.

### D3: MUI as primary framework + shadcn/ui for dynamic accents

**Decision:** Use MUI (Material UI) as the primary component framework for layout, navigation, dialogs, and forms. Use shadcn/ui for select interactive components where its design adds visual dynamism (e.g., command palette, toast notifications, animated cards).

**Rationale:** MUI provides a comprehensive component set with built-in theming, accessibility, and a mature ecosystem. shadcn/ui adds modern, copy-paste components that are easy to customize with Tailwind CSS. Using both leverages MUI's structural strength and shadcn's visual flair.

**Integration:** Both use different styling approaches (MUI uses Emotion by default, shadcn uses Tailwind). To avoid conflicts:
- Configure MUI with `@mui/material` + Tailwind CSS v4 coexistence (MUI supports `styled-engine` swapping, but the simplest path is letting both coexist — MUI for its components, Tailwind for custom styling and shadcn)
- Use MUI's `CssBaseline` as the reset, with Tailwind's preflight disabled to avoid conflicts

### D4: Custom titlebar with MUI AppBar

**Decision:** Implement the frameless window titlebar using MUI's `AppBar` + `Toolbar` components with Tauri's `data-tauri-drag-region` attribute.

**Rationale:** The old app used Quasar's `q-bar` with menu dropdowns (File, Edit, View, Window, Help) and window controls (minimize, maximize, close). MUI's AppBar provides the same structure with better theming. Window control buttons invoke Tauri's `appWindow` API (`minimize()`, `toggleMaximize()`, `close()`).

### D5: Streaming pagination via Tauri events

**Decision:** The Rust file engine sends image batches to the frontend via Tauri events (similar to the old `async:imageLinks-append` IPC pattern), enabling progressive rendering as directories are scanned.

**Rationale:** The old `AsyncReadFilePath` class accumulated images in pages and sent them via `webContents.send()`. Tauri's event system (`app.emit()` / `listen()`) provides the same push-based pattern. The frontend appends batches to the Zustand store, and masonic's virtualized grid renders them incrementally.

**Flow:**
```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   Frontend                          Rust Backend         │
│                                                          │
│   invoke("scan_directory",  ──────▶ Start walkdir        │
│     { paths, formats,              traversal             │
│       page_size, sort })                │                 │
│                                         ▼                │
│                                    Read batch of         │
│                                    N images + dims       │
│                                         │                │
│   Zustand store  ◀──────────────  emit("images:batch",   │
│   appends batch                     { images, done })    │
│       │                                 │                │
│       ▼                                 ▼                │
│   masonic re-renders              Continue until         │
│   (virtualized)                   all files scanned      │
│                                         │                │
│   UI shows "scan                        ▼                │
│   complete"  ◀──────────────────  emit("images:batch",   │
│                                     { images: [], done }) │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### D6: Zustand store architecture

**Decision:** Three Zustand stores, mirroring the old Pinia stores but with cleaner separation:

| Store | Responsibility |
|-------|---------------|
| `useSettingsStore` | Persisted settings (formats, sort, page size, language, viewer prefs). Synced bidirectionally with tauri-plugin-store. |
| `useViewerStore` | Runtime viewer state (images array, current index, viewer open/closed, scan status). Not persisted. |
| `useAppStore` | App-level state (selected folders, window state, UI flags). Not persisted. |

### D7: wouter routing structure

**Decision:** Minimal routes mirroring v1.4.0:

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `HomePage` | Folder selector + waterfall grid |
| `/settings` | `SettingsPage` | Settings panel (or modal/drawer from any page) |
| `/about` | `AboutPage` | App info, version, links |

Settings may alternatively be a MUI Drawer rather than a separate route, matching the old overlay pattern (`setStore.isOpen`). Decision deferred to implementation.

### D8: Biome for linting + formatting

**Decision:** Use Biome as the single linter and formatter, replacing ESLint + Prettier.

**Rationale:** 10-25x faster, single config file, single dependency. Biome 2.0+ has type inference and covers React hooks rules. For a new project with no existing ESLint config investment, Biome is strictly better.

### D9: GitHub Actions CI/CD

**Decision:** Two workflows:

1. **CI (on PR/push to dev/master):** Biome check, tsc, cargo fmt, cargo clippy, build verification on Ubuntu only (save CI minutes on PRs).
2. **Release (on v* tag push):** Full matrix build on Windows + macOS (x64+ARM) + Linux (x64), create draft GitHub Release with artifacts and `latest.json` for auto-updater.

**Actions:** `tauri-apps/tauri-action@v0`, `oven-sh/setup-bun@v2`, `Swatinem/rust-cache@v2`, `dtolnay/rust-toolchain@stable`.

### D10: Renovate for dependency management

**Decision:** Use Renovate over Dependabot for automated dependency updates.

**Rationale:** Better cross-ecosystem grouping (Cargo + npm), Bun lockfile support, auto-merge for patches, monorepo awareness.

## Risks / Trade-offs

**[MUI + Tailwind coexistence]** → Two styling systems add complexity. Mitigate by using MUI for its components only and Tailwind for all custom styling. Avoid mixing MUI's `sx` prop with Tailwind classes on the same element.

**[shadcn/ui + MUI overlap]** → Some components exist in both. Mitigate by establishing a clear rule: MUI for structural/form components, shadcn for decorative/interactive accents. Document which components come from which library.

**[Tauri v2 ecosystem maturity]** → Tauri v2 is stable but younger than Electron. Some edge cases in asset protocol or plugin interactions may surface. Mitigate by staying on stable releases and testing cross-platform early.

**[Rust learning curve]** → If contributors are JS-focused, the Rust backend may be a barrier. Mitigate by keeping the Rust surface small (file engine + commands) and well-documented.

**[typesafe-i18n bundle size]** → Minimal risk — typesafe-i18n is compile-time with near-zero runtime. But it's less widely adopted than react-i18next, so community support is thinner. Mitigate by keeping the i18n layer simple (2 locales, flat key structure).

**[masonic maintenance]** → masonic is functional but has infrequent updates. If it becomes unmaintained, @tanstack/react-virtual with custom masonry layout is the fallback.

**[No video viewer in v2.0]** → Video format support was commented out in v1.4.0. Deferring to post-launch avoids scope creep but means regression for users who relied on partial video support. Mitigate by documenting this as a known gap and planning a follow-up.
