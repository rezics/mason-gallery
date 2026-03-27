## 1. Project Scaffold

- [ ] 1.1 Initialize Tauri v2 + React 19 + Vite + TypeScript project using `bun create tauri-app` (or manual scaffolding)
- [ ] 1.2 Configure `tsconfig.json` with strict mode, path aliases (`@/` → `src/`)
- [ ] 1.3 Install and configure Tailwind CSS v4 with Vite plugin
- [ ] 1.4 Install and configure MUI (`@mui/material`, `@emotion/react`, `@emotion/styled`) with Tailwind coexistence (disable Tailwind preflight)
- [ ] 1.5 Install and configure shadcn/ui (init with Tailwind CSS, add base components)
- [ ] 1.6 Install and configure Biome (`biome.json` with lint + format rules, React JSX support)
- [ ] 1.7 Add `.gitignore`, `.editorconfig`, and project metadata to `package.json`
- [ ] 1.8 Verify `bun run dev` launches the Tauri dev window with React rendering

## 2. Tauri Backend — Rust File Engine

- [ ] 2.1 Add Rust dependencies to `src-tauri/Cargo.toml`: `walkdir`, `image`, `rayon`, `trash`, `serde`, `serde_json`, `natord`
- [ ] 2.2 Implement `scan_directory` Tauri command: accepts paths, formats, page_size, sort_method; recursively walks directories
- [ ] 2.3 Implement image metadata extraction (width/height via `image` crate header-only read) with graceful error handling for corrupt files
- [ ] 2.4 Implement sorting: natural sort (natord) for name-asc/desc, file mtime for time-asc/desc
- [ ] 2.5 Implement streaming batch emission via Tauri events (`images:batch` with batch data + `done` flag)
- [ ] 2.6 Implement `delete_to_trash` Tauri command using `trash` crate
- [ ] 2.7 Define shared TypeScript types for the Tauri command/event API (`WImage`, scan params, etc.)

## 3. Asset Protocol Configuration

- [ ] 3.1 Configure `tauri.conf.json` asset scope for user-selected directories
- [ ] 3.2 Add `tauri-plugin-persisted-scope` to remember filesystem permissions across sessions
- [ ] 3.3 Implement utility function to convert local file paths to `asset://localhost/` URLs with proper encoding
- [ ] 3.4 Verify images render correctly via asset protocol (including paths with spaces and unicode)

## 4. Tauri Plugins Setup

- [ ] 4.1 Add and configure `tauri-plugin-store` (Rust + JS sides)
- [ ] 4.2 Add and configure `tauri-plugin-fs` (Rust + JS sides)
- [ ] 4.3 Add and configure `tauri-plugin-dialog` (Rust + JS sides)
- [ ] 4.4 Add and configure `tauri-plugin-opener` (Rust + JS sides)
- [ ] 4.5 Add and configure `tauri-plugin-updater` + `tauri-plugin-process` (Rust + JS sides)
- [ ] 4.6 Add and configure `tauri-plugin-window-state` (Rust side)
- [ ] 4.7 Add and configure `tauri-plugin-single-instance` (Rust side)

## 5. State Management (Zustand)

- [ ] 5.1 Install zustand
- [ ] 5.2 Create `useSettingsStore` with all settings fields (formats, sort, pageSize, language, breakpoints, viewerPrefs) and tauri-plugin-store sync
- [ ] 5.3 Create `useViewerStore` with image list, current index, viewer open state, scan status
- [ ] 5.4 Create `useAppStore` with selected folders, UI flags (settings drawer open, etc.)
- [ ] 5.5 Implement store hydration on app startup (load persisted settings from tauri-plugin-store)

## 6. Internationalization (typesafe-i18n)

- [ ] 6.1 Install and initialize typesafe-i18n with `en` (default) and `zh` locales
- [ ] 6.2 Define base translation keys for all UI strings (titlebar menus, settings labels, tips, buttons, status messages)
- [ ] 6.3 Create Chinese translations for all keys
- [ ] 6.4 Integrate typesafe-i18n provider into the React app root
- [ ] 6.5 Wire language selection in settings store to locale switching

## 7. Routing (wouter)

- [ ] 7.1 Install wouter
- [ ] 7.2 Set up hash-based router with routes: `/` (HomePage), `/about` (AboutPage)
- [ ] 7.3 Create placeholder page components: `HomePage`, `AboutPage`
- [ ] 7.4 Add catch-all route redirecting to `/`

## 8. App Shell — Custom Titlebar

- [ ] 8.1 Configure `tauri.conf.json` with `"decorations": false` for frameless window
- [ ] 8.2 Implement custom titlebar component using MUI AppBar + Toolbar with `data-tauri-drag-region`
- [ ] 8.3 Add window control buttons (minimize, maximize/restore, close) using Tauri's `appWindow` API
- [ ] 8.4 Add titlebar dropdown menus (File → Quit, Window → Dev Tools, Help → About) using MUI Menu components
- [ ] 8.5 Style titlebar for cross-platform consistency (Windows vs macOS button placement)

## 9. Folder Management

- [ ] 9.1 Implement folder selection via `tauri-plugin-dialog` (open native folder picker, multi-select)
- [ ] 9.2 Implement drag-and-drop folder handling on the app window (dragover/drop events)
- [ ] 9.3 Create upload/drop zone component for empty state (prominent UI with instructions)
- [ ] 9.4 Implement reset/refresh action to clear current folders and return to empty state
- [ ] 9.5 Wire folder selection to `scan_directory` Tauri command invocation

## 10. Waterfall View

- [ ] 10.1 Install masonic
- [ ] 10.2 Create waterfall grid component using masonic's `Masonry` with virtualization
- [ ] 10.3 Implement responsive column breakpoints (default: 500→2, 800→3, 1200→4, 1400→5)
- [ ] 10.4 Implement image thumbnail cell component with correct aspect ratio rendering via asset protocol URLs
- [ ] 10.5 Wire streaming image batches from Tauri events to the masonic grid (progressive rendering)
- [ ] 10.6 Implement click handler on thumbnails to open the image viewer at the clicked index

## 11. Image Viewer

- [ ] 11.1 Install yet-another-react-lightbox with zoom plugin
- [ ] 11.2 Create lightbox viewer component wired to the viewer store (image list, current index, open state)
- [ ] 11.3 Implement keyboard navigation (left/right arrows, Escape to close)
- [ ] 11.4 Implement zoom (Ctrl + mouse wheel) and pan via the zoom plugin
- [ ] 11.5 Implement Delete key handler: invoke `delete_to_trash`, remove from store, advance to next image
- [ ] 11.6 Implement auto-scroll to last-viewed image when viewer closes

## 12. Settings Panel

- [ ] 12.1 Create settings drawer component using MUI Drawer
- [ ] 12.2 Add image format editor (chip list with add/remove)
- [ ] 12.3 Add sort method selector (MUI Select with 4 options)
- [ ] 12.4 Add per-page count input (MUI Slider or NumberInput)
- [ ] 12.5 Add language selector (MUI Select: English / 简体中文)
- [ ] 12.6 Add waterfall breakpoint editor
- [ ] 12.7 Wire all settings controls to `useSettingsStore` with immediate persistence

## 13. About Page

- [ ] 13.1 Create About page with app name, version (from tauri.conf.json), author info, and project links
- [ ] 13.2 Add link to GitHub repository using `tauri-plugin-opener`

## 14. FAB Actions

- [ ] 14.1 Create floating action button (MUI SpeedDial or Fab) in bottom-right corner
- [ ] 14.2 Add refresh action (reset and rescan current folders)
- [ ] 14.3 Add settings action (open settings drawer)

## 15. CI/CD — GitHub Actions

- [ ] 15.1 Create `.github/workflows/ci.yml` — PR checks: Biome ci, tsc --noEmit, cargo fmt --check, cargo clippy -D warnings
- [ ] 15.2 Create `.github/workflows/release.yml` — tag-triggered cross-platform build with `tauri-apps/tauri-action@v0`
- [ ] 15.3 Configure release workflow matrix: windows-latest, macos-latest (x64 + ARM64), ubuntu-22.04
- [ ] 15.4 Add `oven-sh/setup-bun@v2` and `Swatinem/rust-cache@v2` to both workflows
- [ ] 15.5 Configure updater artifact generation (`latest.json`) in release workflow
- [ ] 15.6 Generate Tauri updater signing key pair and document secret setup in README

## 16. Dependency Management

- [ ] 16.1 Create `renovate.json` with recommended config, Rust + npm grouping, and auto-merge for patches

## 17. Auto-Update Integration

- [ ] 17.1 Configure `tauri-plugin-updater` in `tauri.conf.json` with public key and GitHub Releases endpoint
- [ ] 17.2 Implement update check on app launch with user notification (MUI Snackbar or Dialog)
- [ ] 17.3 Implement download + install + relaunch flow

## 18. Polish and Verification

- [ ] 18.1 Verify all Biome, tsc, cargo fmt, and cargo clippy checks pass
- [ ] 18.2 Test cross-platform: Windows, macOS, Linux builds produce valid artifacts
- [ ] 18.3 Test full user flow: select folder → waterfall loads → click image → viewer opens → navigate → delete → close → position restored
- [ ] 18.4 Test settings persistence across app restarts
- [ ] 18.5 Test drag-and-drop folder opening
- [ ] 18.6 Test i18n switching (English ↔ Chinese)
