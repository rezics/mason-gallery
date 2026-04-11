## 1. Rust Dependencies & Shared State

- [x] 1.1 Add `axum`, `tower-http`, and `tokio` (full features) to `Cargo.toml`
- [x] 1.2 Create shared `AllowedRoots` type (`Arc<RwLock<HashSet<PathBuf>>>`) and a `ServerState` struct holding it plus the assigned port, add to Tauri managed state

## 2. Axum Image Server

- [x] 2.1 Create `src-tauri/src/server.rs` with the Axum server: bind to `127.0.0.1:0`, extract port, return a `JoinHandle` and the port
- [x] 2.2 Implement `GET /image?path=` handler: decode path param, canonicalize, check against allowed roots, serve file with correct `Content-Type`
- [x] 2.3 Add `Cache-Control: private, max-age=3600, immutable` and `ETag` (path + mtime hash) headers; handle `If-None-Match` for 304 responses
- [x] 2.4 Return proper error responses: 400 (missing param), 403 (out of scope / traversal), 404 (not found)

## 3. Server Lifecycle & Integration

- [x] 3.1 Start the Axum server in `tauri::Builder::setup()`, store port and shared state in Tauri managed state
- [x] 3.2 Add `get_image_server_port` Tauri command that returns the port from managed state
- [x] 3.3 Update `scan_directory` to register scanned paths into `AllowedRoots` before emitting batches

## 4. Frontend Adapter

- [x] 4.1 Update `TauriPlatformService.getImageUrl()` to return `http://localhost:${port}/image?path=${encodeURIComponent(source)}` instead of `convertFileSrc(source)`
- [x] 4.2 Fetch and cache the server port on first call (invoke `get_image_server_port` once, store the result)
- [x] 4.3 Remove the `convertFileSrc` import if no longer used elsewhere

## 5. Configuration Cleanup

- [x] 5.1 Remove `protocol-asset` from Tauri features in `Cargo.toml` if no other code depends on it (verify first)
- [x] 5.2 Update `tauri.conf.json` security section: removed `assetProtocol` config (CSP is null, no changes needed)
