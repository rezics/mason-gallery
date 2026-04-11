## 1. Rust Dependencies & SQLite Setup

- [x] 1.1 Add Rust dependencies: `zip`, `sevenz-rust`, `unrar`, `rusqlite` (with `bundled` feature), `aes-gcm`, `pbkdf2`, `sha2`, `rand`
- [x] 1.2 Create SQLite database module — initialize `cache.db` in app data dir with `archives`, `thumbnails`, and `passwords` tables on first use
- [x] 1.3 Wire up SQLite state into Tauri managed state (`tauri::Builder::manage()`)

## 2. Archive Reader Core

- [x] 2.1 Define `ArchiveReader` trait with methods: `list_entries`, `extract_entry`, `get_info`, `is_encrypted`, `is_solid`
- [x] 2.2 Implement `ZipArchiveReader` using the `zip` crate — file listing, single entry extraction, password support
- [x] 2.3 Implement `RarArchiveReader` using the `unrar` crate — file listing, single entry extraction, solid detection, password support
- [x] 2.4 Implement `SevenZArchiveReader` using `sevenz-rust` — file listing, single entry extraction, solid detection, password support
- [x] 2.5 Implement format detection from magic bytes and a factory function that returns the correct reader
- [x] 2.6 Parse `archive:///` URIs — extract archive path and entry path from the URI scheme

## 3. Thumbnail Generation & Cache Pipeline

- [x] 3.1 Implement thumbnail generation: extract image → resize to max 400px → encode WebP → save to `<cache-dir>/thumbs/<archive-hash>/<entry-hash>.webp`
- [x] 3.2 Implement cache lookup in SQLite — given archive hash + entry path, return cached thumb path and dimensions if available
- [x] 3.3 Implement cache invalidation — compare stored hash (path + size + mtime) with current file, purge stale entries
- [x] 3.4 Implement `scan_archive` Tauri command — read archive index, check cache, generate missing thumbnails in parallel with rayon, emit `images:count` + `images:batch` events
- [x] 3.5 Implement `extract_archive_entry` Tauri command — extract full-size image to `<cache-dir>/extracted/` on demand, return local path

## 4. Archive Info & Cache Management Commands

- [x] 4.1 Implement `get_archive_info` Tauri command — return format, entry count, total size, is_solid, is_encrypted
- [x] 4.2 Implement `get_cache_stats` Tauri command — query SQLite for all cached archives with sizes, counts, pin status, last accessed
- [x] 4.3 Implement `clear_cache` Tauri command — delete thumbnails/extracted files from disk, remove SQLite records (single archive or all)
- [x] 4.4 Implement `pin_cache` Tauri command — toggle is_pinned in SQLite
- [x] 4.5 Implement startup cache cleanup — on app init, if strategy is "auto-clean", delete all non-pinned caches

## 5. Migration Detection

- [x] 5.1 Implement migration candidate search — query `archives` table by `filename + file_size` when exact path match fails
- [x] 5.2 Implement reverse path segment comparison — split paths into segments, reverse, count consecutive exact matches from tail to find best candidate
- [x] 5.3 Implement `check_migration` Tauri command — given a new archive path, return migration candidate (old path + match score) or null
- [x] 5.4 Implement `confirm_migration` Tauri command — update `archive_path` and `archive_hash` in SQLite for the matched entry
- [x] 5.5 Create `MigrationConfirmDialog` frontend component — show old path, new path, and [Use Cache] / [Scan Fresh] buttons
- [x] 5.6 Integrate migration check into archive open flow — after exact cache miss, call `check_migration`, show dialog if candidate found
- [x] 5.7 Add i18n keys for migration dialog (EN + ZH-TW)

## 6. Password Management (Rust)

- [x] 6.1 Implement in-memory password cache (HashMap behind Mutex in Tauri state)
- [x] 6.2 Implement `unlock_archive` Tauri command — validate password by reading first entry, store in memory, optionally persist
- [x] 6.3 Implement plaintext password persistence — save/load from SQLite `passwords` table
- [x] 6.4 Implement master password encryption — PBKDF2 key derivation + AES-256-GCM encrypt/decrypt, store salt+IV+ciphertext in SQLite
- [x] 6.5 Implement password migration — when switching modes, re-encrypt or delete all stored passwords

## 7. Image HTTP Server Extension

- [x] 7.1 Add `GET /thumb?archive=<hash>&entry=<hash>` endpoint to the Axum server for serving cached thumbnails
- [x] 7.2 Add cache directory as an implicit allowed root in the access control middleware
- [x] 7.3 Ensure `getImageUrl()` in `TauriPlatformService` handles `archive:///` URIs — return thumb URL for browsing, extracted file URL for viewer

## 8. PlatformService & Type Extensions

- [x] 8.1 Add `canBrowseArchives` to `PlatformCapabilities` (true for desktop, false for web)
- [x] 8.2 Add archive-related methods to `PlatformService` interface: `scanArchive`, `extractArchiveEntry`, `getArchiveInfo`, `getCacheStats`, `clearCache`, `pinCache`, `unlockArchive`, `checkMigration`, `confirmMigration`
- [x] 8.3 Implement archive methods in `TauriPlatformService` — invoke the new Tauri commands
- [x] 8.4 Add no-op / unsupported stubs in `WebPlatformService`
- [x] 8.5 Define TypeScript types: `ArchiveInfo`, `CacheStats`, `ScanArchiveParams`, `PasswordStorageMode`, `MigrationCandidate`

## 9. Frontend — Folder Management Updates

- [x] 9.1 Extend drag-and-drop handler to detect `.zip`/`.rar`/`.7z` files and route to `scanArchive`
- [x] 9.2 Add "Open Archive" button/option to the UI — open a file picker filtered to archive extensions
- [x] 9.3 Update drop zone UI text to indicate archive support
- [x] 9.4 Handle archive entries discovered during directory scan — render as clickable "virtual folder" items in the grid

## 10. Frontend — Password & Warning Dialogs

- [x] 10.1 Create `PasswordDialog` component — password input, "Remember password" checkbox, error state, Submit/Cancel
- [x] 10.2 Create `MasterPasswordDialog` component — for setting and entering the master password
- [x] 10.3 Integrate password flow into archive opening — detect `PasswordRequired` error, show dialog, retry with password
- [x] 10.4 Add solid archive warning dialog — show estimated cache size, recommend extraction, Continue/Cancel buttons

## 11. Frontend — Cache Management Page

- [x] 11.1 Add `/cache` route to the wouter router
- [x] 11.2 Create `CacheManagement` page component — list cached archives with name, size, entry count, last accessed, pin status
- [x] 11.3 Implement per-archive actions: delete cache, toggle pin, copy path
- [x] 11.4 Implement bulk actions: "Clear unpinned" and "Clear all" buttons with confirmation dialogs
- [x] 11.5 Display total cache size summary at the top of the page

## 12. Frontend — Settings Updates

- [x] 12.1 Add "Archives" section to the settings panel
- [x] 12.2 Add "Cache Cleanup" dropdown: "Auto-clean on startup" / "Keep all"
- [x] 12.3 Add "Password Storage" dropdown: "Don't save" / "Plaintext" / "Master password" with mode-switch side effects
- [x] 12.4 Add "Manage Cache" navigation link to the `/cache` page

## 13. State Management & Store Updates

- [x] 13.1 Extend `useSettingsStore` with `cacheCleanupStrategy` and `passwordStorageMode` settings, persisted via platform service
- [x] 13.2 Add archive-related state to `useAppStore` or create `useArchiveStore` — current archive path, loading state, password prompts, migration state

## 14. i18n

- [x] 14.1 Add English translation keys for all archive-related UI: dialogs, cache page, settings section, error messages, drop zone text, migration dialog
- [x] 14.2 Add Traditional Chinese translation keys for all archive-related UI
