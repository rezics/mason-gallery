## Context

WViewer v2.0 is a Tauri v2 desktop image viewer with React 19 frontend. The frontend directly imports `@tauri-apps/api` and various Tauri plugins in 7+ source files — components (`WaterfallGrid`, `ImageViewer`, `DropZone`, `Titlebar`, `UpdateChecker`), stores (`settingsStore`), and service modules (`scanActions`). There is no abstraction layer between UI and platform APIs.

The goal is to restructure into a monorepo that enables independent desktop and web releases from a shared UI core, plus an npm-installable CLI wrapper for the web build.

This is an open-source project using Bun, Vite 8, React 19, MUI 7, Tailwind CSS v4, Zustand 5, masonic, and wouter.

## Goals / Non-Goals

**Goals:**
- Clean separation between platform-agnostic UI and platform-specific adapters
- Web version supports: drag-and-drop folders, waterfall masonry grid, lightbox image viewing, settings persistence
- Desktop version retains ALL current features and remains extensible
- npm CLI package for local web server (`npx @wviewer/cli`)
- Shared code changes propagate to both targets automatically
- Minimal disruption — refactor by extraction, not rewrite

**Non-Goals:**
- Adding new features beyond what exists (this is a restructuring change)
- Server-side rendering or SSR for the web version
- Backend API server (web version is fully client-side)
- Mobile deployment
- Changing the UI framework (MUI stays)
- Supporting browsers without File System Access API (Chromium-only is acceptable for v1)

## Decisions

### D1: Bun workspaces for monorepo management

**Decision:** Use Bun's built-in workspace support over pnpm, Turborepo, or Nx.

**Rationale:** The project already uses Bun. Bun workspaces provide package linking, shared `node_modules`, and parallel script execution natively. No additional tooling needed. The monorepo has only 4 packages — heavy orchestrators like Nx/Turborepo add complexity without payoff at this scale.

**Configuration:**
```jsonc
// root package.json
{
  "workspaces": ["packages/*"]
}
```

### D2: PlatformService interface as the abstraction boundary

**Decision:** Define a `PlatformService` TypeScript interface in `packages/core` that all platform-dependent operations go through. Provide it via React Context.

**Rationale:** Every Tauri API call in the current codebase maps to a discrete operation (scan, get image URL, delete file, persist settings, pick folder, drag-drop). Abstracting these behind an interface is the minimal-surface refactor — components swap `import { invoke } from "@tauri-apps/api/core"` for `usePlatform().scanImages(...)`. No component logic changes.

**Interface design:**

```typescript
interface PlatformService {
  // Capabilities — components use these to conditionally render features
  capabilities: {
    canDeleteFiles: boolean;      // desktop: true, web: false
    canSelectFolder: boolean;     // desktop: true, web: limited (showDirectoryPicker)
    hasCustomTitlebar: boolean;   // desktop: true, web: false
    canAutoUpdate: boolean;       // desktop: true, web: false
    canDragDropFolders: boolean;  // desktop: true (Tauri events), web: true (HTML5)
  };

  // Image scanning — returns void, pushes batches via callback
  scanImages(
    params: ScanParams,
    onBatch: (batch: ImageBatch) => void,
    onComplete: () => void,
  ): Promise<void>;

  // Convert image identifier to displayable URL
  getImageUrl(source: string): string;

  // File operations
  deleteFile(path: string): Promise<void>;

  // Folder selection (native dialog or browser picker)
  pickFolders(): Promise<string[] | null>;

  // Drag-drop subscription — returns cleanup function
  onDragDrop(callback: (paths: string[]) => void): () => void;

  // Settings persistence
  loadSettings(): Promise<Partial<Settings>>;
  saveSettings(key: string, value: unknown): Promise<void>;
}
```

**Alternatives considered:**
- *Conditional imports (dynamic `import()`)* — Fragile, breaks tree-shaking, requires build-time platform detection. Rejected.
- *Feature flags with `#ifdef`-style macros* — Vite `define` plugin can do this, but scatters platform logic across components. Rejected.
- *Dependency injection without React Context* — Module-level singleton works but makes testing harder and is less idiomatic React. Rejected.

### D3: Web image scanning via File System Access API + image-dimensions

**Decision:** The web adapter uses the browser's File System Access API (`showDirectoryPicker` / `DataTransferItem.getAsFileSystemHandle()`) for folder access, and the `image-dimensions` library (sindresorhus, ~18.7KB, zero deps) for header-only image size extraction.

**Rationale:** From our research, `image-dimensions` supports PNG, JPEG, GIF, WebP, AVIF, HEIC by reading only the file header bytes — the same strategy as the Rust `image` crate but for the browser. It provides `imageDimensionsFromStream()` which pairs perfectly with `File.stream()`. For unsupported formats (e.g., BMP), fall back to `createImageBitmap()` which decodes minimally.

**Web scan flow:**

```
User drags folder onto page
    ↓
HTML5 DragEvent → DataTransferItem.getAsFileSystemHandle()
    ↓ (or showDirectoryPicker)
FileSystemDirectoryHandle
    ↓
Recursive async generator: walk(dirHandle, formats)
    ↓ yields FileSystemFileHandle[]
For each batch of N files:
    ├── file.getFile() → File object
    ├── file.stream() → imageDimensionsFromStream() → { width, height }
    ├── URL.createObjectURL(file) → displayable URL
    └── Push ImageBatch via onBatch callback
    ↓
onComplete()
```

**Image URL strategy:**
- Desktop: `convertFileSrc(absolutePath)` → `asset://localhost/...` (existing)
- Web: `URL.createObjectURL(file)` → `blob:...` (new)
- The `WImage.source` field means different things per platform: desktop stores filesystem path strings, web stores blob URLs. Both are opaque strings consumed only by `getImageUrl()`.

**Compatibility note:** File System Access API (`showDirectoryPicker`) is Chromium-only (Chrome, Edge, Opera, Arc). Firefox and Safari do not support it. The drag-drop entry point (`DataTransferItem.webkitGetAsEntry()`) has broader support for flat file lists but limited recursive directory traversal. This is acceptable for v1 — document the browser requirement.

### D4: Monorepo package structure

**Decision:** Four packages under `packages/`:

```
packages/
├── core/           ← Shared: components, stores, types, i18n, PlatformService interface
│   ├── src/
│   │   ├── components/     ← WaterfallGrid, ImageViewer, DropZone, SettingsDrawer, FabActions
│   │   ├── stores/         ← viewerStore, appStore, settingsStore (platform-agnostic)
│   │   ├── types/          ← WImage, ImageBatch, ScanParams, Settings, PlatformService
│   │   ├── i18n/           ← typesafe-i18n translations
│   │   ├── context/        ← PlatformContext (React Context for PlatformService)
│   │   └── index.ts        ← Public API barrel export
│   ├── package.json        ← name: "@wviewer/core"
│   └── tsconfig.json
│
├── desktop/        ← Tauri desktop app
│   ├── src/
│   │   ├── adapters/
│   │   │   └── TauriPlatformService.ts
│   │   ├── components/     ← Titlebar, UpdateChecker (desktop-only)
│   │   ├── App.tsx          ← Desktop shell (Titlebar + core components)
│   │   └── main.tsx
│   ├── src-tauri/          ← Rust backend (moved from root)
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json        ← name: "@wviewer/desktop"
│
├── web/            ← Static web SPA
│   ├── src/
│   │   ├── adapters/
│   │   │   └── WebPlatformService.ts
│   │   ├── App.tsx          ← Web shell (no Titlebar, no UpdateChecker)
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json        ← name: "@wviewer/web"
│
└── cli/            ← npm-installable local web server
    ├── src/
    │   └── index.ts         ← CLI entry: serve web dist via sirv/polka
    ├── package.json         ← name: "@wviewer/cli", bin: { "wviewer": "..." }
    └── tsconfig.json
```

**Rationale:** This is the standard split for multi-platform apps from a shared codebase. `core` has zero platform deps and is consumed as an internal workspace dependency by both `desktop` and `web`. The CLI package bundles the web build output and serves it.

**Dependency graph:**
```
┌─────────┐     ┌──────────┐     ┌─────────┐
│ desktop │────▶│   core   │◀────│   web   │
└─────────┘     └──────────┘     └─────────┘
                     ▲
                     │
                ┌─────────┐
                │   cli   │ (embeds web dist)
                └─────────┘
```

### D5: Store refactoring — inject persistence via PlatformService

**Decision:** `useSettingsStore` loses its direct `@tauri-apps/plugin-store` import. Instead, its `hydrate()` and `persist()` functions call `PlatformService.loadSettings()` / `PlatformService.saveSettings()`.

**Rationale:** The current `settingsStore.ts` is the only store with a Tauri dependency (plugin-store for persistence). The other stores (`viewerStore`, `appStore`) are already platform-agnostic. By routing persistence through `PlatformService`, the store moves cleanly to `core`.

**Implementation pattern:**

```typescript
// packages/core/src/stores/settingsStore.ts
import { getPlatform } from "@/context/PlatformContext";

async function persist(key: string, value: unknown) {
  const platform = getPlatform(); // module-level accessor, set during app init
  await platform.saveSettings(key, value);
}

export const useSettingsStore = create<SettingsState>((set) => ({
  // ... same as current, but hydrate() calls platform.loadSettings()
}));
```

The `getPlatform()` accessor is set once at app startup before any store hydration — this avoids circular dependency between stores and React context.

### D6: DropZone dual-mode — Tauri events vs HTML5 drag-drop

**Decision:** `DropZone` in `core` uses the `PlatformService.onDragDrop()` and `PlatformService.pickFolders()` abstractions. Each adapter implements these differently:

| Operation | Desktop (Tauri) | Web (Browser) |
|-----------|----------------|---------------|
| Drag-drop | `getCurrentWebviewWindow().onDragDropEvent()` — receives filesystem paths | `HTML5 ondragover/ondrop` → `DataTransferItem.getAsFileSystemHandle()` — receives `FileSystemHandle` objects |
| Folder picker | `open({ directory: true, multiple: true })` → filesystem paths | `showDirectoryPicker()` → `FileSystemDirectoryHandle` |
| Path representation | Absolute filesystem path strings | Opaque handle IDs (web adapter maps handles internally) |

**Key design choice:** On the web, "paths" are synthetic IDs that the `WebPlatformService` maps to `FileSystemHandle` objects internally. The core components never see `FileSystemHandle` — they just pass opaque `string` identifiers around, and the adapter resolves them when needed (e.g., for `getImageUrl()` or `scanImages()`).

### D7: CLI package — simple static server wrapper

**Decision:** `@wviewer/cli` is a thin Node.js script that:
1. Bundles the pre-built `packages/web/dist/` output at publish time
2. On `npx @wviewer/cli` or `wviewer` (global install), starts a local HTTP server on a free port
3. Opens the user's default browser

**Rationale:** This gives users a zero-config way to use the web version locally without cloning the repo or setting up a dev server. The implementation is ~30 lines using `sirv-cli` or a minimal `node:http` + `node:fs` static file server.

**Build pipeline:**
```
bun run --filter @wviewer/web build
    ↓
packages/web/dist/  (static assets)
    ↓ (copied into cli package at publish time)
packages/cli/dist/web/
    ↓
npm publish @wviewer/cli
```

### D8: Conditional rendering via capabilities

**Decision:** Desktop-only components are conditionally rendered based on `PlatformService.capabilities`, not via separate component trees.

**Example in App.tsx (core provides a `Shell` component):**

```tsx
// packages/core/src/components/Shell.tsx
export function Shell({ titlebar, updateChecker, children }) {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <I18nContext.Provider value={translations}>
        <Router hook={useHashLocation}>
          {titlebar}   {/* desktop passes <Titlebar/>, web passes null */}
          <Box sx={{ pt: titlebar ? "36px" : 0, height: "100vh" }}>
            {children}
          </Box>
          <SettingsDrawer />
          {updateChecker} {/* desktop passes <UpdateChecker/>, web passes null */}
        </Router>
      </I18nContext.Provider>
    </ThemeProvider>
  );
}
```

**Rationale:** This keeps `core` components fully portable while letting each app inject platform-specific chrome. The core `Shell` doesn't import `Titlebar` or `UpdateChecker` — it receives them as render props. This avoids any Tauri imports leaking into core.

### D9: Vite build configuration per package

**Decision:** Each package has its own Vite config:

| Package | Build target | Output |
|---------|-------------|--------|
| `core` | Library mode (`vite build --lib`) | ES modules, consumed by desktop & web at build time |
| `desktop` | Tauri app (same as current) | Tauri bundle |
| `web` | Static SPA (`vite build`) | `dist/` with `index.html` + assets |
| `cli` | `tsup` or `bun build` | Single CJS/ESM entry + bundled web dist |

**Rationale:** Library mode for `core` ensures tree-shaking works — both consumers only bundle the components they import. Desktop and web each have their own `index.html` and entry point.

**Shared Vite config:** Extract common config (React plugin, Tailwind, path aliases) into a `packages/core/vite.shared.ts` that desktop and web extend.

## Risks / Trade-offs

**[File System Access API browser support]** → Chromium-only. Firefox users cannot use the web version's folder picker. Mitigate by documenting the requirement prominently and providing a fallback drag-drop experience for flat file lists using standard `<input type="file">`.

**[Blob URL memory management]** → `URL.createObjectURL()` creates memory-pinned references. With thousands of images, this could cause memory pressure in the browser. Mitigate by implementing a sliding window that revokes blob URLs for off-screen images and recreates them on demand (pairs well with masonic's virtualization).

**[Web image scanning performance]** → Browser-side recursive directory traversal + header parsing is inherently slower than Rust with rayon. For 10,000+ images, expect noticeably slower scan times on web. Mitigate by streaming batches (same pattern as desktop) so the UI loads progressively. Consider Web Workers for the scan loop in a future iteration.

**[Monorepo build complexity]** → Four packages means coordinating build order. Mitigate by keeping `core` as a source dependency (Vite resolves workspace packages directly) rather than requiring a separate build step during development. Only `vite build --lib` is needed for production.

**[PlatformService abstraction overhead]** → Adding an indirection layer increases code surface. Mitigate by keeping the interface minimal (9 methods + 1 capabilities object) and co-locating the interface with its documentation in `core/src/types/`.

**[CLI package maintenance]** → Another artifact to publish and version. Mitigate by automating: the CI release workflow builds web, copies dist into cli, publishes both.
