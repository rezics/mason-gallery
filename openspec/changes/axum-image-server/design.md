## Context

The Tauri desktop app currently serves images via `convertFileSrc()`, which routes every `<img>` load through Tauri's custom `asset://` protocol handler. This handler performs an IPC round-trip per image (webview → Rust → disk → Rust → webview), causing visible scroll jank and reflows when many images enter the viewport at once. The web version uses blob URLs that go through the browser's native image pipeline and outperforms Tauri in rendering despite having slower dimension scanning. The goal is to let Tauri's frontend use the browser's native HTTP image loading — the same mechanism that makes the web version smooth.

## Goals / Non-Goals

**Goals:**
- Eliminate per-image IPC overhead during scroll by serving images over a real HTTP endpoint
- Leverage the browser's native HTTP stack (caching, parallel connections, lazy decoding)
- Minimal changes to the frontend — only `getImageUrl()` output changes
- Secure by default: localhost-only, scoped to scanned directories

**Non-Goals:**
- Memory optimization (blob URL lifecycle, image eviction) — deferred
- Replacing the asset protocol for non-image uses (e.g., app assets, fonts)
- Thumbnail generation or image transcoding
- HTTPS/TLS for the local server (unnecessary for loopback)

## Decisions

### 1. Axum on a random loopback port

Use `axum` with `tower-http::services::ServeDir` or a custom handler. Bind to `127.0.0.1:0` so the OS assigns an available port. Store the port in Tauri's managed state and expose it to the frontend via a Tauri command (`get_image_server_port`).

**Why Axum over alternatives:**
- `axum` is the Rust ecosystem standard for async HTTP, built on `tokio` + `hyper`
- Tauri 2 already depends on `tokio`, so no new runtime
- `tower-http` provides production-ready middleware for static files, caching headers, and CORS
- Lightweight: the server is just a file-serving endpoint, not a full web app

**Rejected alternatives:**
- `warp`: less maintained, smaller ecosystem than axum
- `tiny_http` / `minreq`: synchronous, would need a dedicated thread; no middleware ecosystem
- Embedding bytes in IPC events: massive payload bloat, defeats the purpose
- JS-side `fetch()` → blob: still JS-bound, adds scan-time latency

### 2. Path-scoped access with runtime directory registration

The server SHALL only serve files from directories the user has explicitly selected (scanned). Maintain a shared `Arc<RwLock<HashSet<PathBuf>>>` of allowed root directories. On each request, canonicalize the requested path and verify it falls under an allowed root. Update the allowed set when `scan_directory` is called.

**Why not a static token or bearer auth:**
- Path scoping is simpler and more robust — no token to leak or manage
- Localhost-only binding already limits access to local processes
- Directory scoping matches the existing security model (Tauri's asset scope uses the same pattern)

### 3. URL scheme: `http://localhost:{port}/{encoded-absolute-path}`

The frontend constructs image URLs as `http://localhost:{port}/image?path={encodeURIComponent(absolutePath)}`. Using a query parameter avoids complex path encoding issues (Windows paths with drive letters, special characters).

**Why query parameter over path segments:**
- Absolute paths like `C:\Users\photos\img.jpg` or `/home/user/photos/img.jpg` don't map cleanly to URL path segments
- `encodeURIComponent` on the full path is unambiguous
- The server decodes `path` param, canonicalizes, checks scope, serves the file

### 4. Caching headers for scroll performance

Serve images with `Cache-Control: private, max-age=3600, immutable` and `ETag` based on file path + modification time. This lets the browser cache images in memory/disk and avoid re-fetching on scroll back-and-forth.

**Why `immutable`:**
- Image files at a given path rarely change during a session
- If the user rescans (refresh), the scan produces new image entries and the modification time in the ETag changes
- `private` ensures no proxy caching (not relevant for localhost, but follows best practice)

### 5. Server lifecycle tied to Tauri app

Start the server in `tauri::Builder::setup()` before the webview loads. Store the `tokio::task::JoinHandle` and a shutdown signal (`tokio::sync::oneshot`) in Tauri managed state. The server shuts down when the app exits (Tauri's runtime drops the state). No explicit shutdown command needed.

### 6. Frontend adapter change is minimal

`TauriPlatformService` gains:
- A cached `serverPort` value fetched once via `invoke("get_image_server_port")`
- `getImageUrl(source)` returns `http://localhost:${port}/image?path=${encodeURIComponent(source)}` instead of `convertFileSrc(source)`

No changes to `WaterfallGrid`, `ImageViewer`, `HomePage`, stores, or any core component.

## Risks / Trade-offs

- **Port conflict** → Mitigated by binding to port `0` (OS-assigned). Extremely unlikely to fail.
- **Firewall/antivirus blocking localhost HTTP** → Rare but possible on locked-down corporate machines. Fallback: re-enable asset protocol via a setting. Not implementing this now, but the `getImageUrl` abstraction makes it trivial later.
- **File access race** (file deleted between scan and HTTP request) → Server returns 404, `<img>` shows broken image. Same behavior as current asset protocol. Not a regression.
- **CSP configuration** → Tauri's CSP is currently `null` (disabled). If CSP is enabled later, `img-src http://localhost:*` must be added. Document this in the spec.
- **WebKitGTK HTTP cache behavior** → WebKitGTK's cache for localhost may differ from Chromium/WebView2. The `Cache-Control` + `ETag` approach is standard and should work, but may need testing on Linux.
