## Context

Mason Gallery currently only browses images from filesystem directories. The Rust backend (`scan_directory`) walks directories with `walkdir`, extracts dimensions with `rayon`, and emits batches via Tauri events. The Axum image server serves files from allowed root directories. The `PlatformService` abstraction separates desktop (Tauri) from web (browser) capabilities.

Users frequently have image collections stored in large compressed archives (ZIP, RAR, 7z) — often password-protected and 10–50+ GB. Full extraction wastes disk space and time. This design adds archive browsing as a desktop-only feature, using a thumbnail cache to make repeated browsing fast and a demand-extraction model for full-size viewing.

## Goals / Non-Goals

**Goals:**
- Browse images inside ZIP, RAR, and 7z archives without full extraction
- Support password-protected archives with optional password persistence
- Provide a responsive browsing experience via cached thumbnails
- Give users control over cache lifecycle (auto-clean, whitelist, manual)
- Integrate archives into existing entry points (drag-drop, file picker, inline discovery)

**Non-Goals:**
- Editing or writing to archives (read-only)
- Streaming decompression for video files
- Web platform support (desktop-only due to filesystem requirements)
- Archive creation or re-compression
- Supporting nested archives (archive inside archive)

## Decisions

### 1. URI scheme for archive entries

**Decision**: Use `archive:///` URI scheme — `archive:///<archive-path>#<entry-path>`

**Example**: `archive:///D:/images/pack.zip#folder/photo.jpg`

**Rationale**: This keeps the `source` field in `ImageBatch` as a single string that flows through the existing pipeline unchanged. `getImageUrl()` parses the prefix and routes to the appropriate serving logic. Alternatives considered:
- Separate `archivePath` + `entryPath` fields → requires changing `WImage` struct and all consumers
- Temp-file extraction upfront → defeats the purpose of lightweight browsing

### 2. SQLite for cache metadata

**Decision**: Use `rusqlite` with a single `cache.db` in the app data directory.

**Schema sketch**:
```sql
archives (
  id            INTEGER PRIMARY KEY,
  archive_path  TEXT UNIQUE NOT NULL,
  archive_hash  TEXT NOT NULL,       -- hash of path + size + mtime for invalidation
  is_solid      BOOLEAN DEFAULT FALSE,
  is_pinned     BOOLEAN DEFAULT FALSE,
  entry_count   INTEGER,
  cache_size    INTEGER DEFAULT 0,   -- bytes, updated on thumbnail generation
  last_accessed TIMESTAMP,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

thumbnails (
  id            INTEGER PRIMARY KEY,
  archive_id    INTEGER REFERENCES archives(id) ON DELETE CASCADE,
  entry_path    TEXT NOT NULL,
  thumb_path    TEXT NOT NULL,        -- relative to cache dir
  width         INTEGER,
  height        INTEGER,
  file_size     INTEGER,
  UNIQUE(archive_id, entry_path)
)

passwords (
  archive_path  TEXT PRIMARY KEY,
  password      TEXT NOT NULL,        -- plaintext or AES-256-GCM encrypted
  encrypted     BOOLEAN DEFAULT FALSE
)
```

**Rationale**: Thousands of entries per archive make JSON unwieldy. SQLite gives indexed queries, atomic updates, and cascading deletes when clearing cache. Alternatives considered:
- JSON index files → parsing 10k+ entries is slow, no atomic writes
- Sled/RocksDB → overkill, less tooling support

### 3. Thumbnail generation pipeline

**Decision**: Generate WebP thumbnails (max 400px on longest side) in a background pipeline that mirrors the existing `scan_directory` batch emission pattern.

```
scan_archive(params)
  │
  ├── Read archive central directory / file index
  ├── Emit images:count with total
  │
  ├── For each batch of entries:
  │   ├── Check SQLite cache
  │   ├── Cache hit → emit batch with cached thumb paths + dimensions
  │   └── Cache miss → extract → resize → save WebP → insert DB → emit batch
  │
  └── Emit final images:batch { done: true }
```

Thumbnails are stored at `<cache-dir>/thumbs/<archive-hash>/<entry-hash>.webp`. The image HTTP server gets a new route: `GET /thumb?archive=<hash>&entry=<hash>`.

**Rationale**: WebP gives good quality at small sizes. The batch-emit pattern is already understood by the frontend. Processing happens on a rayon thread pool for parallelism.

### 4. Full-image extraction (on-demand)

**Decision**: When the user opens the image viewer for an archive entry, extract the full image to `<cache-dir>/extracted/<archive-hash>/` and serve it via the existing image server endpoint. Extracted full images are treated as temporary — cleaned up more aggressively than thumbnails.

### 5. Solid archive handling

**Decision**: Detect solid compression during archive open. If solid, show a warning dialog explaining cache implications and recommending extraction. If the user proceeds, extract the entire solid block to cache (unavoidable for solid archives). Track the higher cache cost in SQLite for display in the cache management UI.

**Detection**:
- RAR: Check archive header flags for solid flag
- 7z: Check if multiple files share a single coder block
- ZIP: Not applicable (ZIP doesn't support solid compression)

### 6. Password flow

```
User opens archive
  │
  ├── Archive not encrypted → proceed
  │
  └── Archive encrypted
      ├── Check in-memory password cache → found → proceed
      ├── Check SQLite passwords table → found → decrypt if needed → proceed
      └── Show password dialog
          ├── User enters password
          ├── Validate by attempting to read first entry
          ├── Success → store in memory
          │   └── User optionally checks "Remember password"
          │       ├── Plaintext mode → save to passwords table
          │       └── Master password mode
          │           ├── Master password set? → encrypt & save
          │           └── Not set? → prompt to set master password → encrypt & save
          └── Failure → show error, retry
```

**Master password encryption**: Derive key with PBKDF2 (100k iterations, random salt), encrypt with AES-256-GCM. Salt and IV stored alongside ciphertext in the passwords table. The master password itself is never stored — only validated by attempting to decrypt.

### 7. Cache cleanup strategies

Three user-selectable modes (stored in settings):

| Mode | Behavior |
|------|----------|
| **Auto-clean** (default) | On app startup, delete all non-pinned archive caches. Pinned archives (⭐ in UI) survive cleanup. |
| **Keep all** | Never auto-delete. User manages via cache page. |

Cache management page (`/cache` route) shows all cached archives with size, entry count, last accessed date, pin status, and per-archive delete buttons. Bulk actions: "Clear unpinned" and "Clear all".

### 8. Archive entry points

Three ways to open an archive, all converging to the same `scan_archive` flow:

1. **Drag-and-drop**: Extend existing `onDragDrop` handler to detect `.zip`/`.rar`/`.7z` extensions
2. **File picker**: Add a new "Open Archive" option alongside "Open Folder", using Tauri's file dialog with archive extension filters
3. **Inline discovery**: When `scan_directory` encounters an archive file, include it in results as a special entry (type: "archive") that the frontend renders as a clickable virtual folder

### 9. Crate selection

| Purpose | Crate | Notes |
|---------|-------|-------|
| ZIP | `zip` (v2.x) | Mature, supports AES + ZipCrypto |
| 7z | `sevenz-rust` | Pure Rust, supports LZMA/LZMA2, AES-256 |
| RAR | `unrar` | FFI binding to unrar library; requires bundling native lib |
| SQLite | `rusqlite` | Well-maintained, bundled SQLite via `bundled` feature |
| Thumbnails | `image` (already in deps) | Resize + WebP encode |
| Encryption | `aes-gcm` + `pbkdf2` | For master password encryption |

### 10. PlatformService extension

Add to `PlatformCapabilities`:
```typescript
canBrowseArchives: boolean  // true for desktop, false for web
```

New methods on `PlatformService`:
```typescript
scanArchive(params: ScanArchiveParams, onBatch, onComplete, onCount): Promise<void>
extractArchiveEntry(archiveUri: string): Promise<string>  // returns temp file path
getArchiveInfo(path: string): Promise<ArchiveInfo>
getCacheStats(): Promise<CacheStats[]>
clearCache(archiveHash?: string): Promise<void>
pinCache(archiveHash: string, pinned: boolean): Promise<void>
unlockArchive(path: string, password: string, remember: boolean): Promise<void>
```

Web platform provides no-op / throw implementations.

## Risks / Trade-offs

- **[RAR FFI dependency]** → The `unrar` crate requires bundling a native C library, increasing build complexity. Mitigation: Use Tauri's sidecar or bundle mechanism; fall back to graceful "RAR not supported" error if the library fails to load.

- **[Solid archive cache explosion]** → A 40GB solid RAR will generate a large temp cache. Mitigation: Pre-scan detection + user warning; track cache size in SQLite; surface prominently in cache management UI.

- **[First-open latency]** → Generating thumbnails for 10k+ images takes time. Mitigation: Stream thumbnails progressively (same batch-emit pattern as directories); show progress indicator; cache makes subsequent opens instant.

- **[Password security in plaintext mode]** → Passwords stored unencrypted on disk. Mitigation: This is opt-in, clearly labeled, and appropriate for non-secret archive passwords. Master password mode available for sensitive use cases.

- **[Cache invalidation]** → Archive file modified/moved after caching. Mitigation: Store hash of (path + file size + mtime) in SQLite; re-validate on open; stale caches auto-purge.
