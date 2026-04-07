## 1. Project Scaffold

- [x] 1.1 Initialize Tauri v2 + React 19 + Vite + TypeScript project using `bun create tauri-app` (or manual scaffolding)
- [x] 1.2 Configure `tsconfig.json` with strict mode, path aliases (`@/` → `src/`)
- [x] 1.3 Install and configure Tailwind CSS v4 with Vite plugin
- [x] 1.4 Install and configure MUI (`@mui/material`, `@emotion/react`, `@emotion/styled`) with Tailwind coexistence (disable Tailwind preflight)
- [x] 1.5 Install and configure shadcn/ui (init with Tailwind CSS, add base components)
- [x] 1.6 Install and configure Biome (`biome.json` with lint + format rules, React JSX support)
- [x] 1.7 Add `.gitignore`, `.editorconfig`, and project metadata to `package.json`
- [ ] 1.8 Verify `bun run dev` launches the Tauri dev window with React rendering

## 2. Tauri Backend — Rust File Engine

- [x] 2.1 Add Rust dependencies to `src-tauri/Cargo.toml`: `walkdir`, `image`, `rayon`, `trash`, `serde`, `serde_json`, `natord`
- [x] 2.2 Implement `scan_directory` Tauri command: accepts paths, formats, page_size, sort_method; recursively walks directories
- [x] 2.3 Implement image metadata extraction (width/height via `image` crate header-only read) with graceful error handling for corrupt files
- [x] 2.4 Implement sorting: natural sort (natord) for name-asc/desc, file mtime for time-asc/desc
- [x] 2.5 Implement streaming batch emission via Tauri events (`images:batch` with batch data + `done` flag)
- [x] 2.6 Implement `delete_to_trash` Tauri command using `trash` crate
- [x] 2.7 Define shared TypeScript types for the Tauri command/event API (`WImage`, scan params, etc.)

## 3. Asset Protocol Configuration

- [x] 3.1 Configure `tauri.conf.json` asset scope for user-selected directories
- [x] 3.2 Add `tauri-plugin-persisted-scope` to remember filesystem permissions across sessions
- [x] 3.3 Implement utility function to convert local file paths to `asset://localhost/` URLs with proper encoding
- [ ] 3.4 Verify images render correctly via asset protocol (including paths with spaces and unicode)

## 4. Tauri Plugins Setup

- [x] 4.1 Add and configure `tauri-plugin-store` (Rust + JS sides)
- [x] 4.2 Add and configure `tauri-plugin-fs` (Rust + JS sides)
- [x] 4.3 Add and configure `tauri-plugin-dialog` (Rust + JS sides)
- [x] 4.4 Add and configure `tauri-plugin-opener` (Rust + JS sides)
- [x] 4.5 Add and configure `tauri-plugin-updater` + `tauri-plugin-process` (Rust + JS sides)
- [x] 4.6 Add and configure `tauri-plugin-window-state` (Rust side)
- [x] 4.7 Add and configure `tauri-plugin-single-instance` (Rust side)

## 5. State Management (Zustand)

- [x] 5.1 Install zustand
- [x] 5.2 Create `useSettingsStore` with all settings fields (formats, sort, pageSize, language, breakpoints, viewerPrefs) and tauri-plugin-store sync
- [x] 5.3 Create `useViewerStore` with image list, current index, viewer open state, scan status
- [x] 5.4 Create `useAppStore` with selected folders, UI flags (settings drawer open, etc.)
- [x] 5.5 Implement store hydration on app startup (load persisted settings from tauri-plugin-store)

## 6. Internationalization (typesafe-i18n)

- [x] 6.1 Install and initialize typesafe-i18n with `en` (default) and `zh` locales
- [x] 6.2 Define base translation keys for all UI strings (titlebar menus, settings labels, tips, buttons, status messages)
- [x] 6.3 Create Chinese translations for all keys
- [x] 6.4 Integrate typesafe-i18n provider into the React app root
- [x] 6.5 Wire language selection in settings store to locale switching

## 7. Routing (wouter)

- [x] 7.1 Install wouter
- [x] 7.2 Set up hash-based router with routes: `/` (HomePage), `/about` (AboutPage)
- [x] 7.3 Create placeholder page components: `HomePage`, `AboutPage`
- [x] 7.4 Add catch-all route redirecting to `/`

## 8. App Shell — Custom Titlebar

- [x] 8.1 Configure `tauri.conf.json` with `"decorations": false` for frameless window
- [x] 8.2 Implement custom titlebar component using MUI AppBar + Toolbar with `data-tauri-drag-region`
- [x] 8.3 Add window control buttons (minimize, maximize/restore, close) using Tauri's `appWindow` API
- [x] 8.4 Add titlebar dropdown menus (File → Quit, Window → Dev Tools, Help → About) using MUI Menu components
- [x] 8.5 Style titlebar for cross-platform consistency (Windows vs macOS button placement)

## 9. Folder Management

- [x] 9.1 Implement folder selection via `tauri-plugin-dialog` (open native folder picker, multi-select)
- [x] 9.2 Implement drag-and-drop folder handling on the app window (dragover/drop events)
- [x] 9.3 Create upload/drop zone component for empty state (prominent UI with instructions)
- [x] 9.4 Implement reset/refresh action to clear current folders and return to empty state
- [x] 9.5 Wire folder selection to `scan_directory` Tauri command invocation

## 10. Waterfall View

- [x] 10.1 Install masonic
- [x] 10.2 Create waterfall grid component using masonic's `Masonry` with virtualization
- [x] 10.3 Implement responsive column breakpoints (default: 500→2, 800→3, 1200→4, 1400→5)
- [x] 10.4 Implement image thumbnail cell component with correct aspect ratio rendering via asset protocol URLs
- [x] 10.5 Wire streaming image batches from Tauri events to the masonic grid (progressive rendering)
- [x] 10.6 Implement click handler on thumbnails to open the image viewer at the clicked index

## 11. Image Viewer

- [x] 11.1 Install yet-another-react-lightbox with zoom plugin
- [x] 11.2 Create lightbox viewer component wired to the viewer store (image list, current index, open state)
- [x] 11.3 Implement keyboard navigation (left/right arrows, Escape to close)
- [x] 11.4 Implement zoom (Ctrl + mouse wheel) and pan via the zoom plugin
- [x] 11.5 Implement Delete key handler: invoke `delete_to_trash`, remove from store, advance to next image
- [x] 11.6 Implement auto-scroll to last-viewed image when viewer closes

## 12. Settings Panel

- [x] 12.1 Create settings drawer component using MUI Drawer
- [x] 12.2 Add image format editor (chip list with add/remove)
- [x] 12.3 Add sort method selector (MUI Select with 4 options)
- [x] 12.4 Add per-page count input (MUI Slider or NumberInput)
- [x] 12.5 Add language selector (MUI Select: English / 简体中文)
- [x] 12.6 Add waterfall breakpoint editor
- [x] 12.7 Wire all settings controls to `useSettingsStore` with immediate persistence

## 13. About Page

- [x] 13.1 Create About page with app name, version (from tauri.conf.json), author info, and project links
- [x] 13.2 Add link to GitHub repository using `tauri-plugin-opener`

## 14. FAB Actions

- [x] 14.1 Create floating action button (MUI SpeedDial or Fab) in bottom-right corner
- [x] 14.2 Add refresh action (reset and rescan current folders)
- [x] 14.3 Add settings action (open settings drawer)

## 15. CI/CD — GitHub Actions

- [x] 15.1 Create `.github/workflows/ci.yml` — PR checks: Biome ci, tsc --noEmit, cargo fmt --check, cargo clippy -D warnings
- [x] 15.2 Create `.github/workflows/release.yml` — tag-triggered cross-platform build with `tauri-apps/tauri-action@v0`
- [x] 15.3 Configure release workflow matrix: windows-latest, macos-latest (x64 + ARM64), ubuntu-22.04
- [x] 15.4 Add `oven-sh/setup-bun@v2` and `Swatinem/rust-cache@v2` to both workflows
- [x] 15.5 Configure updater artifact generation (`latest.json`) in release workflow
- [x] 15.6 Generate Tauri updater signing key pair and document secret setup in README

## 16. Dependency Management

- [x] 16.1 Create `renovate.json` with recommended config, Rust + npm grouping, and auto-merge for patches

## 17. Auto-Update Integration

- [x] 17.1 Configure `tauri-plugin-updater` in `tauri.conf.json` with public key and GitHub Releases endpoint
- [x] 17.2 Implement update check on app launch with user notification (MUI Snackbar or Dialog)
- [x] 17.3 Implement download + install + relaunch flow

## 18. Polish and Verification

- [x] 18.1 Verify all Biome, tsc, cargo fmt, and cargo clippy checks pass
- [x] 18.2 Test cross-platform: Windows, macOS, Linux builds produce valid artifacts
- [x] 18.3 Test full user flow: select folder → waterfall loads → click image → viewer opens → navigate → delete → close → position restored
- [x] 18.4 Test settings persistence across app restarts
- [x] 18.5 Test drag-and-drop folder opening
- [x] 18.6 Test i18n switching (English ↔ Chinese)
