## Why

Tauri's `asset://` protocol introduces per-image IPC overhead on every scroll, causing choppy scrolling, slow content loading, and frequent reflows. The web version — using blob URLs that go through the browser's native `<img>` pipeline — outperforms Tauri in every aspect except dimension scanning. Since blob URL conversion in JS is also too slow for large collections, we need a solution that lets the browser load images natively without JS intermediary: an embedded HTTP server in Rust.

## What Changes

- Add an embedded Axum HTTP server to the Tauri Rust backend that serves image files from user-selected directories over `http://localhost:<port>/`
- **BREAKING**: Replace `convertFileSrc()` (asset protocol) with localhost HTTP URLs in `TauriPlatformService.getImageUrl()`
- Add security measures: bind to `127.0.0.1` only, scoped path access (only serve files from scanned directories), optional request token
- Update `scan_directory` to emit localhost URLs instead of raw file paths
- Update Tauri CSP configuration to allow `img-src http://localhost:*`
- Remove the `protocol-asset` feature dependency from Tauri (can be done later once fully migrated)

## Capabilities

### New Capabilities
- `image-http-server`: Embedded Axum HTTP server that serves local image files over localhost with proper caching headers, path scoping, and security controls

### Modified Capabilities
- `asset-protocol`: Replace asset protocol URLs with localhost HTTP URLs for image serving. The asset protocol scope and persisted-scope may remain for other file access but are no longer used for image rendering.
- `rust-file-engine`: The `scan_directory` command output changes from raw file paths to localhost HTTP URLs in the `source` field, or the frontend adapter constructs URLs from paths using the known server port.

## Impact

- **Rust backend** (`src-tauri/src/`): New `server.rs` module with Axum, changes to `lib.rs` for server lifecycle, possible changes to `commands.rs` for port communication
- **Dependencies** (`Cargo.toml`): Add `axum`, `tower-http` (for static file serving, CORS, caching headers); `tokio` is already available via Tauri
- **Frontend adapter** (`TauriPlatformService.ts`): `getImageUrl()` switches from `convertFileSrc()` to `http://localhost:<port>/<encoded-path>`
- **Tauri config** (`tauri.conf.json`): CSP update for localhost access; `protocol-asset` feature may be removed
- **Existing specs**: `asset-protocol` spec requirements change, `rust-file-engine` image data structure requirement changes
