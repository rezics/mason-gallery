## 1. Rust Dependencies & SQLite Setup

- [ ] 1.1 Add Rust dependencies: `zip`, `sevenz-rust`, `unrar`, `rusqlite` (with `bundled` feature), `aes-gcm`, `pbkdf2`, `sha2`, `rand`
- [ ] 1.2 Create SQLite database module — initialize `cache.db` in app data dir with `archives`, `thumbnails`, and `passwords` tables on first use
- [ ] 1.3 Wire up SQLite state into Tauri managed state (`tauri::Builder::manage()`)

## 2. Archive Reader Core

- [ ] 2.1 Define `ArchiveReader` trait with methods: `list_entries`, `extract_entry`, `get_info`, `is_encrypted`, `is_solid`
- [ ] 2.2 Implement `ZipArchiveReader` using the `zip` crate — file listing, single entry extraction, password support
- [ ] 2.3 Implement `RarArchiveReader` using the `unrar` crate — file listing, single entry extraction, solid detection, password support
- [ ] 2.4 Implement `SevenZArchiveReader` using `sevenz-rust` — file listing, single entry extraction, solid detection, password support
- [ ] 2.5 Implement format detection from magic bytes and a factory function that returns the correct reader
- [ ] 2.6 Parse `archive:///` URIs — extract archive path and entry path from the URI scheme

## 3. Thumbnail Generation & Cache Pipeline

- [ ] 3.1 Implement thumbnail generation: extract image → resize to max 400px → encode WebP → save to `<cache-dir>/thumbs/<archive-hash>/<entry-hash>.webp`
- [ ] 3.2 Implement cache lookup in SQLite — given archive hash + entry path, return cached thumb path and dimensions if available
- [ ] 3.3 Implement cache invalidation — compare stored hash (path + size + mtime) with current file, purge stale entries
- [ ] 3.4 Implement `scan_archive` Tauri command — read archive index, check cache, generate missing thumbnails in parallel with rayon, emit `images:count` + `images:batch` events
- [ ] 3.5 Implement `extract_archive_entry` Tauri command — extract full-size image to `<cache-dir>/extracted/` on demand, return local path

## 4. Archive Info & Cache Management Commands

- [ ] 4.1 Implement `get_archive_info` Tauri command — return format, entry count, total size, is_solid, is_encrypted
- [ ] 4.2 Implement `get_cache_stats` Tauri command — query SQLite for all cached archives with sizes, counts, pin status, last accessed
- [ ] 4.3 Implement `clear_cache` Tauri command — delete thumbnails/extracted files from disk, remove SQLite records (single archive or all)
- [ ] 4.4 Implement `pin_cache` Tauri command — toggle is_pinned in SQLite
- [ ] 4.5 Implement startup cache cleanup — on app init, if strategy is "auto-clean", delete all non-pinned caches

## 5. Migration Detection

- [ ] 5.1 Implement migration candidate search — query `archives` table by `filename + file_size` when exact path match fails
- [ ] 5.2 Implement reverse path segment comparison — split paths into segments, reverse, count consecutive exact matches from tail to find best candidate
- [ ] 5.3 Implement `check_migration` Tauri command — given a new archive path, return migration candidate (old path + match score) or null
- [ ] 5.4 Implement `confirm_migration` Tauri command — update `archive_path` and `archive_hash` in SQLite for the matched entry
- [ ] 5.5 Create `MigrationConfirmDialog` frontend component — show old path, new path, and [Use Cache] / [Scan Fresh] buttons
- [ ] 5.6 Integrate migration check into archive open flow — after exact cache miss, call `check_migration`, show dialog if candidate found
- [ ] 5.7 Add i18n keys for migration dialog (EN + ZH-TW)

## 6. Password Management (Rust)

- [ ] 6.1 Implement in-memory password cache (HashMap behind Mutex in Tauri state)
- [ ] 6.2 Implement `unlock_archive` Tauri command — validate password by reading first entry, store in memory, optionally persist
- [ ] 6.3 Implement plaintext password persistence — save/load from SQLite `passwords` table
- [ ] 6.4 Implement master password encryption — PBKDF2 key derivation + AES-256-GCM encrypt/decrypt, store salt+IV+ciphertext in SQLite
- [ ] 6.5 Implement password migration — when switching modes, re-encrypt or delete all stored passwords

## 7. Image HTTP Server Extension

- [ ] 7.1 Add `GET /thumb?archive=<hash>&entry=<hash>` endpoint to the Axum server for serving cached thumbnails
- [ ] 7.2 Add cache directory as an implicit allowed root in the access control middleware
- [ ] 7.3 Ensure `getImageUrl()` in `TauriPlatformService` handles `archive:///` URIs — return thumb URL for browsing, extracted file URL for viewer

## 8. PlatformService & Type Extensions

- [ ] 8.1 Add `canBrowseArchives` to `PlatformCapabilities` (true for desktop, false for web)
- [ ] 8.2 Add archive-related methods to `PlatformService` interface: `scanArchive`, `extractArchiveEntry`, `getArchiveInfo`, `getCacheStats`, `clearCache`, `pinCache`, `unlockArchive`, `checkMigration`, `confirmMigration`
- [ ] 8.3 Implement archive methods in `TauriPlatformService` — invoke the new Tauri commands
- [ ] 8.4 Add no-op / unsupported stubs in `WebPlatformService`
- [ ] 8.5 Define TypeScript types: `ArchiveInfo`, `CacheStats`, `ScanArchiveParams`, `PasswordStorageMode`, `MigrationCandidate`

## 9. Frontend — Folder Management Updates

- [ ] 9.1 Extend drag-and-drop handler to detect `.zip`/`.rar`/`.7z` files and route to `scanArchive`
- [ ] 9.2 Add "Open Archive" button/option to the UI — open a file picker filtered to archive extensions
- [ ] 9.3 Update drop zone UI text to indicate archive support
- [ ] 9.4 Handle archive entries discovered during directory scan — render as clickable "virtual folder" items in the grid

## 10. Frontend — Password & Warning Dialogs

- [ ] 10.1 Create `PasswordDialog` component — password input, "Remember password" checkbox, error state, Submit/Cancel
- [ ] 10.2 Create `MasterPasswordDialog` component — for setting and entering the master password
- [ ] 10.3 Integrate password flow into archive opening — detect `PasswordRequired` error, show dialog, retry with password
- [ ] 10.4 Add solid archive warning dialog — show estimated cache size, recommend extraction, Continue/Cancel buttons

## 11. Frontend — Cache Management Page

- [ ] 11.1 Add `/cache` route to the wouter router
- [ ] 11.2 Create `CacheManagement` page component — list cached archives with name, size, entry count, last accessed, pin status
- [ ] 11.3 Implement per-archive actions: delete cache, toggle pin, copy path
- [ ] 11.4 Implement bulk actions: "Clear unpinned" and "Clear all" buttons with confirmation dialogs
- [ ] 11.5 Display total cache size summary at the top of the page

## 12. Frontend — Settings Updates

- [ ] 12.1 Add "Archives" section to the settings panel
- [ ] 12.2 Add "Cache Cleanup" dropdown: "Auto-clean on startup" / "Keep all"
- [ ] 12.3 Add "Password Storage" dropdown: "Don't save" / "Plaintext" / "Master password" with mode-switch side effects
- [ ] 12.4 Add "Manage Cache" navigation link to the `/cache` page

## 13. State Management & Store Updates

- [ ] 13.1 Extend `useSettingsStore` with `cacheCleanupStrategy` and `passwordStorageMode` settings, persisted via platform service
- [ ] 13.2 Add archive-related state to `useAppStore` or create `useArchiveStore` — current archive path, loading state, password prompts, migration state

## 14. i18n

- [ ] 14.1 Add English translation keys for all archive-related UI: dialogs, cache page, settings section, error messages, drop zone text, migration dialog
- [ ] 14.2 Add Traditional Chinese translation keys for all archive-related UI
