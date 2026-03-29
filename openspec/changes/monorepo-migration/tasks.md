## 1. Monorepo Infrastructure

- [x] 1.1 Create `packages/` directory with subdirectories: `core/`, `desktop/`, `web/`, `cli/`
- [x] 1.2 Create root `package.json` with `"workspaces": ["packages/*"]`, move dev scripts (`check`, `format`) to root
- [x] 1.3 Create root `tsconfig.json` as base config with shared `compilerOptions` (strict, paths, JSX)
- [x] 1.4 Create `packages/core/package.json` — name `@wviewer/core`, peer deps on react/react-dom, deps on zustand/masonic/wouter/MUI/typesafe-i18n/yet-another-react-lightbox
- [x] 1.5 Create `packages/desktop/package.json` — name `@wviewer/desktop`, deps on `@wviewer/core` + all `@tauri-apps/*` packages
- [x] 1.6 Create `packages/web/package.json` — name `@wviewer/web`, deps on `@wviewer/core` + `image-dimensions`
- [x] 1.7 Create `packages/cli/package.json` — name `@wviewer/cli`, bin field, deps on `sirv` (or `polka` + `sirv`)
- [x] 1.8 Create per-package `tsconfig.json` files extending root config, with correct `paths` and `references`
- [x] 1.9 Move `biome.json` to root, update include paths for `packages/*/src`
- [x] 1.10 Run `bun install` and verify workspace linking resolves all packages

## 2. PlatformService Abstraction Layer

- [x] 2.1 Define `PlatformService` interface in `packages/core/src/types/platform.ts` — all methods and `capabilities` object as specified in design D2
- [x] 2.2 Create `PlatformContext` in `packages/core/src/context/PlatformContext.tsx` — React Context + `usePlatform()` hook + module-level `setPlatform()` / `getPlatform()` accessor for use outside React (stores)
- [x] 2.3 Export `PlatformService`, `PlatformContext`, `usePlatform`, `setPlatform`, `getPlatform` from `packages/core/src/index.ts`

## 3. Move Shared Code to packages/core

- [x] 3.1 Move `src/types/index.ts` → `packages/core/src/types/index.ts`, add `Settings` type (union of all settings fields)
- [x] 3.2 Move `src/stores/viewerStore.ts` → `packages/core/src/stores/viewerStore.ts` (already platform-agnostic, no changes needed)
- [x] 3.3 Move `src/stores/appStore.ts` → `packages/core/src/stores/appStore.ts` (already platform-agnostic, no changes needed)
- [x] 3.4 Move `src/stores/settingsStore.ts` → `packages/core/src/stores/settingsStore.ts` — replace `import { load } from "@tauri-apps/plugin-store"` with `getPlatform().loadSettings()` / `getPlatform().saveSettings()` calls
- [x] 3.5 Move `src/i18n/` → `packages/core/src/i18n/` (no platform deps)
- [x] 3.6 Move and refactor `src/components/WaterfallGrid.tsx` → `packages/core/src/components/WaterfallGrid.tsx` — replace `convertFileSrc(data.source)` with `usePlatform().getImageUrl(data.source)`
- [x] 3.7 Move and refactor `src/components/ImageViewer.tsx` → `packages/core/src/components/ImageViewer.tsx` — replace `convertFileSrc()` with `usePlatform().getImageUrl()`, replace `invoke("delete_to_trash")` with `usePlatform().deleteFile()`, conditionally show delete based on `capabilities.canDeleteFiles`
- [x] 3.8 Move and refactor `src/components/DropZone.tsx` → `packages/core/src/components/DropZone.tsx` — replace Tauri `onDragDropEvent` + `open()` with `usePlatform().onDragDrop()` + `usePlatform().pickFolders()`
- [x] 3.9 Move `src/components/SettingsDrawer.tsx` → `packages/core/src/components/SettingsDrawer.tsx` (likely no Tauri deps)
- [x] 3.10 Move `src/components/FabActions.tsx` → `packages/core/src/components/FabActions.tsx` (likely no Tauri deps)
- [x] 3.11 Move and refactor `src/lib/scanActions.ts` → `packages/core/src/lib/scanActions.ts` — replace `invoke()` + `open()` with `getPlatform().scanImages()` + `getPlatform().pickFolders()`
- [x] 3.12 Move `src/pages/HomePage.tsx` → `packages/core/src/pages/HomePage.tsx` — remove Tauri event listener (`listen("images:batch")`), scanning is now handled internally by `PlatformService.scanImages()` callback
- [x] 3.13 Move `src/pages/AboutPage.tsx` → `packages/core/src/pages/AboutPage.tsx` — replace `openUrl()` from `@tauri-apps/plugin-opener` with `window.open()` (works on both platforms)
- [x] 3.14 Create `packages/core/src/components/Shell.tsx` — shared app shell accepting `titlebar` and `updateChecker` as render props (design D8)
- [x] 3.15 Create `packages/core/src/index.ts` barrel export — all public components, stores, types, context, and i18n

## 4. Desktop Adapter (packages/desktop)

- [x] 4.1 Create `packages/desktop/src/adapters/TauriPlatformService.ts` implementing `PlatformService`:
  - `scanImages()`: invoke `scan_directory` + listen to `images:batch` events, relay via callbacks
  - `getImageUrl()`: `convertFileSrc(source)`
  - `deleteFile()`: `invoke("delete_to_trash", { path })`
  - `pickFolders()`: `open({ directory: true, multiple: true })`
  - `onDragDrop()`: `getCurrentWebviewWindow().onDragDropEvent()`, return unlisten
  - `loadSettings()`: `load("settings.json")` → read all keys
  - `saveSettings()`: `load("settings.json")` → `store.set(key, value)`
  - `capabilities`: all true except as appropriate
- [x] 4.2 Move `src/components/Titlebar.tsx` → `packages/desktop/src/components/Titlebar.tsx` (desktop-only, retains Tauri window API imports)
- [x] 4.3 Move `src/components/UpdateChecker.tsx` → `packages/desktop/src/components/UpdateChecker.tsx` (desktop-only, retains Tauri updater imports)
- [x] 4.4 Create `packages/desktop/src/App.tsx` — imports `Shell` from core, passes `<Titlebar>` and `<UpdateChecker>` as props, wraps with `PlatformContext.Provider` using `TauriPlatformService`
- [x] 4.5 Create `packages/desktop/src/main.tsx` — calls `setPlatform(tauriPlatformService)` then `ReactDOM.createRoot().render(<App/>)`
- [x] 4.6 Move `src-tauri/` → `packages/desktop/src-tauri/` (Rust backend, no changes to Rust code)
- [x] 4.7 Move `index.html` → `packages/desktop/index.html`, update script src to `src/main.tsx`
- [x] 4.8 Create `packages/desktop/vite.config.ts` — extend shared config, add Tauri-specific `server` settings (port 1420, HMR, watch ignore)
- [x] 4.9 Update `packages/desktop/src-tauri/tauri.conf.json` — update `frontendDist` and `devUrl` paths if needed
- [ ] 4.10 Verify `bun run --filter @wviewer/desktop dev` launches the Tauri dev window correctly

## 5. Web Adapter (packages/web)

- [x] 5.1 Create `packages/web/src/adapters/WebPlatformService.ts` implementing `PlatformService`:
  - `scanImages()`: recursive async directory walk via `FileSystemDirectoryHandle`, use `image-dimensions` (`imageDimensionsFromStream`) for size extraction, batch results via callback
  - `getImageUrl()`: return the blob URL directly (stored in internal `Map<string, string>`)
  - `deleteFile()`: throw or no-op (not supported)
  - `pickFolders()`: `showDirectoryPicker({ mode: "read" })` → return synthetic path IDs
  - `onDragDrop()`: HTML5 `dragenter`/`dragover`/`drop` events on `document`, extract `FileSystemHandle` via `DataTransferItem.getAsFileSystemHandle()`
  - `loadSettings()`: `JSON.parse(localStorage.getItem("wviewer-settings"))` with fallback to defaults
  - `saveSettings()`: merge key into localStorage JSON object
  - `capabilities`: `{ canDeleteFiles: false, canSelectFolder: true, hasCustomTitlebar: false, canAutoUpdate: false, canDragDropFolders: true }`
- [x] 5.2 Implement internal `FileHandleRegistry` in `WebPlatformService` — maps synthetic string IDs to `{ handle: FileSystemFileHandle, blobUrl: string }`, manages `URL.createObjectURL` / `URL.revokeObjectURL` lifecycle
- [x] 5.3 Implement recursive directory walker: `async function* walkDirectory(dirHandle, formats, depth?)` — yields `{ name, path, handle, width, height }` objects, filters by format extensions
- [x] 5.4 Add `image-dimensions` to `packages/web/package.json` dependencies
- [x] 5.5 Create `packages/web/src/App.tsx` — imports `Shell` from core, passes `null` for titlebar and updateChecker, wraps with `PlatformContext.Provider` using `WebPlatformService`
- [x] 5.6 Create `packages/web/src/main.tsx` — calls `setPlatform(webPlatformService)` then renders
- [x] 5.7 Create `packages/web/index.html` — minimal HTML without Tauri-specific meta tags
- [x] 5.8 Create `packages/web/vite.config.ts` — extend shared config, standard SPA build, `base: "./"` for relative asset paths
- [ ] 5.9 Verify `bun run --filter @wviewer/web dev` serves the web app, drag-drop works in Chrome/Edge

## 6. CLI Package (packages/cli)

- [x] 6.1 Create `packages/cli/src/index.ts` — parse args, start HTTP server serving bundled web dist, open browser with `open` package or `child_process`
- [x] 6.2 Create build script: copies `packages/web/dist/` into `packages/cli/dist/web/` before publish
- [x] 6.3 Configure `packages/cli/package.json` — `"bin": { "wviewer": "./dist/index.js" }`, `"files": ["dist/"]`
- [x] 6.4 Add `sirv` (lightweight static file server) to dependencies
- [ ] 6.5 Test: `bun run --filter @wviewer/web build && bun run --filter @wviewer/cli start` opens browser with working web app

## 7. Build Scripts and Root Configuration

- [x] 7.1 Add root-level scripts to `package.json`:
  - `"dev:desktop": "bun run --filter @wviewer/desktop dev"`
  - `"dev:web": "bun run --filter @wviewer/web dev"`
  - `"build:desktop": "bun run --filter @wviewer/desktop build"`
  - `"build:web": "bun run --filter @wviewer/web build"`
  - `"build:cli": "bun run --filter @wviewer/web build && bun run --filter @wviewer/cli build"`
  - `"check": "biome ci . && tsc --build"`
- [x] 7.2 Configure TypeScript project references (`tsconfig.json` `references` array) for incremental builds across packages
- [x] 7.3 Move shared Vite config into `packages/core/vite.shared.ts` (React plugin, Tailwind plugin, path aliases)
- [x] 7.4 Update `biome.json` include/exclude paths for monorepo structure
- [x] 7.5 Update `.gitignore` for per-package `dist/`, `node_modules/` in root only (hoisted)

## 8. CI/CD Updates

- [x] 8.1 Update `.github/workflows/ci.yml` — run `bun install` at root, `biome ci .`, `tsc --build`, `cargo fmt`/`clippy` in `packages/desktop/src-tauri/`
- [x] 8.2 Update `.github/workflows/release.yml` — build desktop via `packages/desktop/`, build web separately
- [x] 8.3 Add web deployment step to CI: build `@wviewer/web` and deploy to GitHub Pages (or Vercel/Netlify) on push to master
- [x] 8.4 Add npm publish step for `@wviewer/cli` on version tag push
- [x] 8.5 Update Renovate config for monorepo package grouping

## 9. Cleanup and Verification

- [ ] 9.1 Remove old root-level `src/`, `src-tauri/`, `index.html`, `vite.config.ts` after confirming packages work
- [ ] 9.2 Update root `README.md` with monorepo structure, development instructions for each package
- [ ] 9.3 Verify `bun run check` passes (biome + tsc) across all packages
- [ ] 9.4 Verify desktop dev and build: `bun run dev:desktop` launches Tauri, full scan → grid → viewer → delete flow works
- [ ] 9.5 Verify web dev and build: `bun run dev:web` serves SPA, drag-drop folder → grid → viewer flow works in Chrome
- [ ] 9.6 Verify CLI: `bun run build:cli && npx @wviewer/cli` starts server and opens browser
- [ ] 9.7 Verify settings persistence on both platforms (desktop: plugin-store, web: localStorage)
- [ ] 9.8 Verify i18n switching works on both platforms
