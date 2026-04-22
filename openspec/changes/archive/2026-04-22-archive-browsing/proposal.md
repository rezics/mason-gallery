## Why

Most image collections are distributed as compressed archives (ZIP, RAR, 7z), often password-protected and tens of gigabytes in size. Users currently must fully extract these archives before browsing — consuming double the disk space and significant time. Mason Gallery should support browsing images directly inside archives with a lightweight, cache-based approach.

## What Changes

- Add a Rust-based archive reader backend supporting ZIP, RAR, and 7z formats (including password-protected archives)
- Introduce an `archive://` URI scheme for referencing images inside archives (e.g., `archive:///D:/images/pack.zip#internal/path/photo.jpg`)
- Generate and cache thumbnails on first open; serve cached thumbnails for browsing and extract full images on demand
- Add a SQLite-backed cache system for thumbnail storage and archive metadata
- Add a cache management page where users can view cache usage, pin archives to prevent auto-cleanup, and manually clear caches
- Add three configurable cache cleanup strategies: auto-clean on app restart (with whitelist), full retention with manual cleanup
- Add migration detection: when opening an archive (or future: folder) whose path has no cache hit, reverse-compare path segments against orphaned cache entries to detect relocated packs, prompt the user to confirm, and auto-update the cached path
- Add password management: passwords stored in memory by default, with opt-in persistence in plaintext or encrypted via a master password (AES-256-GCM)
- Support three entry points for opening archives: drag-and-drop, file picker (extended to accept archive files), and inline discovery (archives shown as virtual folders during directory browsing)
- Detect solid archives (RAR/7z) and warn users about high cache cost before proceeding
- Desktop-only feature — gated behind `PlatformCapabilities`

## Capabilities

### New Capabilities
- `archive-reader`: Rust backend for reading archive file lists and extracting individual entries from ZIP, RAR, and 7z formats, including password-protected archives
- `archive-cache`: SQLite-based thumbnail cache with configurable cleanup strategies, whitelist support, a UI management page, and migration detection via reverse path matching
- `archive-passwords`: Password prompt flow, in-memory storage, and optional persistence (plaintext or master-password-encrypted)

### Modified Capabilities
- `rust-file-engine`: `scan_directory` extended to detect archive files and delegate to the archive reader; new `scan_archive` command added
- `image-http-server`: New endpoint to serve images extracted from archives and cached thumbnails, with `archive://` URI resolution
- `folder-management`: File picker and drag-and-drop extended to accept `.zip`, `.rar`, `.7z` files alongside folders; archives discovered inside folders shown as virtual entries
- `settings-panel`: New settings section for archive cache cleanup strategy and password storage mode

## Impact

- **Rust backend**: New dependencies — `zip`, `sevenz-rust`, `unrar` (FFI), `rusqlite`, `image` (thumbnail generation), `ring` or `aes-gcm` (password encryption)
- **Tauri commands**: New commands `scan_archive`, `extract_archive_entry`, `get_archive_info`, `manage_cache`, `unlock_archive`
- **PlatformService**: New `capabilities.canBrowseArchives` flag; new methods for archive operations
- **Frontend**: New cache management route (`/cache`), password dialog component, solid archive warning dialog, migration confirmation modal
- **State management**: New Zustand store or extension for archive/cache state
- **i18n**: New translation keys for archive-related UI strings (EN + ZH-TW)
