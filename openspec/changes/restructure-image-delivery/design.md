## Context

The `archive-browsing` change shipped a working-but-incorrect architecture. Concretely:

- `TauriPlatformService.getImageUrl(source)` is called by both `WaterfallGrid` and `ImageViewer` with no way to differentiate intent.
- The Axum handler `image_handler` inspects `source` for the `archive:///` prefix and, if present, dispatches to `serve_archive_thumb` — which returns the cached 400px WebP thumbnail regardless of caller.
- `extract_archive_entry` was added as an escape hatch for "give me the original", but it returns a raw filesystem path — unusable as an `<img src>`. No frontend code calls it.
- `ImageBatch` entries carry a single `source` string, so the emitter has no way to communicate "here are N thumbnails at various resolutions" for `srcset`.

The root cause: the `archive://` URI was overloaded to mean both *this entry belongs to an archive* and *render me the thumbnail*. Fixing the viewer bug in isolation would require `<img src=originalThumbUrl>` on the grid and `<img src=extractedPath>` on the viewer — impossible because extracted paths can't be loaded from the webview without routing through the HTTP server anyway.

This change rebuilds the delivery layer so that:

1. URIs identify *where* bytes come from (`archive://` or `file://`), not *what form* to render.
2. Endpoints decide form: `/image` always returns originals, `/thumb` always returns thumbnails.
3. Thumbnails are a first-class delivery mode — carried in `ImageBatch` as a multi-resolution array, rendered via standard web `srcset` semantics.
4. The server owns extraction and its cache lifecycle — frontend never sees disk paths.
5. Cache becomes configurable and segmented (thumbs vs extracted) with application-level defaults and per-source overrides.

The archive-browsing cache feature has **not** yet reached end users, so we can wipe existing cache on first launch without migration concerns.

## Goals / Non-Goals

**Goals:**
- Split thumbnail and original delivery into two cleanly separated pipelines end-to-end (URI → service → endpoint → frontend consumer).
- Move all extraction logic to the Axum server (via a Rust service layer), eliminating disk-path leakage into the frontend.
- Reshape `ImageBatch` to carry optional multi-resolution thumbnails per entry.
- Unify SQLite schema so that `archive` and `folder` sources share the same cache management code path.
- Allow cache policy configuration at both application and per-source granularity, with independent clearing of thumbnail and extracted caches.
- Fix the image-viewer-shows-thumbnail bug as a consequence of the rework.

**Non-Goals:**
- Generating thumbnails for folder (non-archive) images — the schema prepares for it, but the actual generation and lazy-trigger pipeline is a follow-up change.
- Auto-discovering archives inside folders (inline discovery / mixed folders) — also a follow-up change.
- Supporting thumbnails on the web platform — `WebPlatformService` returns no-ops for thumbnail APIs.
- Changing the `archive://` URI format itself — it remains `archive:///<archive-path>#<entry-path>`.
- Changing the `images:batch` event name or the high-level scan flow.
- Handling nested archives.

## Decisions

### 1. Two URI schemes, two endpoints, no overlap

**Decision**: Clean 1:1 mapping between URI scheme, frontend method, and HTTP endpoint.

```
Original delivery
─────────────────
source = "archive:///D:/pack.zip#a.jpg"   OR   "file:///D:/a.jpg"   OR a bare Windows path
  → platform.getImageUrl(source)
  → http://127.0.0.1:PORT/image?path=<urlencode(source)>
  → axum image_handler
  → image_service::resolve_original(source) -> Bytes
      ├─ archive:/// → archive_service::extract_or_cache(archive, entry) -> cached path -> read bytes
      └─ file://  or bare path → canonicalize + allowed_roots check -> read bytes

Thumbnail delivery
──────────────────
thumbId = "mg-thumb:///<sourceHash>/<entryHash>?w=400"
  → platform.getThumbUrl(thumbId)
  → http://127.0.0.1:PORT/thumb?source=<sourceHash>&entry=<entryHash>&w=400
  → axum thumb_handler
  → thumbnail_service::resolve(sourceHash, entryHash, w) -> Bytes
      └─ reads cache/thumbs/<sourceHash>/<entryHash>_<w>.webp
```

**Rationale**: The previous "one endpoint, dispatch by URI prefix" scheme is the exact anti-pattern that caused the bug. One endpoint per delivery form makes the contract unambiguous. The `mg-thumb://` scheme is symmetric with `archive://` — both are opaque-to-frontend identifiers that `PlatformService` resolves to HTTP URLs.

**Alternatives considered:**
- Single `getImageUrl(source, variant?: "thumb" | "original")` — rejected; the return value for `variant="thumb"` when no thumbnail exists would have awkward semantics (null? throw? fall back?), and the caller has to know whether thumbs exist anyway.
- Embed fully-formed URLs in the `ImageBatch` payload — rejected; couples backend emission to URL format, and forces port discovery to happen before batch emission.

### 2. `ImageBatch` reshape with multi-resolution thumbnails

**Decision**: Entries carry an optional thumbnail array; rendering injects attributes dynamically.

```typescript
interface ImageEntry {
  source: string;                   // original URI — always used by viewer
  relativePath: string;
  width: number | null;             // original dimensions (may be known even without thumbs)
  height: number | null;
  thumbnails?: Thumbnail[];         // undefined or [] = no thumbs, use source directly
}

interface Thumbnail {
  source: string;                   // mg-thumb:// URI
  width: number;                    // for srcset "Nw" descriptor
  height: number;
}
```

Rendering (single path, no branches):

```tsx
const srcSet = entry.thumbnails?.length
  ? entry.thumbnails
      .map((t) => `${platform.getThumbUrl(t.source)} ${t.width}w`)
      .join(", ")
  : undefined;

<img
  src={platform.getImageUrl(entry.source)}
  srcSet={srcSet}
  sizes={gridColumnSizesHint}
  width={entry.width ?? undefined}
  height={entry.height ?? undefined}
  loading="lazy"
/>
```

**Browser behavior relied upon**: When `srcSet` is defined, the browser picks a candidate; `src` is consulted only if no candidate matches or if `srcSet` is unsupported. We always emit at least one `Nw` descriptor when thumbnails exist, so the original is only fetched when `thumbnails` is `undefined`/`[]` — i.e., the intentional "direct original" case. `width`/`height` are independent of the thumbnail branch (they describe the original and are often known from scan-time metadata).

**Rationale**: Web-standard `srcset` gives us responsive image selection for free and matches user's stated "follow the web thumbnail spec" requirement. One render path eliminates an entire class of branching bugs.

### 3. Rust service layer; `server.rs` becomes a thin transport

**Decision**: Extract business logic into dedicated modules, shared by Tauri commands and Axum handlers.

```
packages/desktop/src-tauri/src/
  server.rs               ← axum routing + error mapping only
  services/
    image_service.rs      ← resolve_original(uri) -> Bytes|path
    archive_service.rs    ← open + list + extract_entry (+ cache coordination)
    thumbnail_service.rs  ← resolve + generate + cache record
    source_service.rs     ← sources table CRUD, migration detection
  archive_commands.rs     ← Tauri commands delegate to services
  commands.rs             ← unchanged (plus thumbnail wiring if needed)
  database.rs             ← rewritten schema
  lib.rs                  ← constructs Arcs, passes to both Tauri state and Axum AppState
```

`AppState` passed into Axum becomes:

```rust
pub struct AppState {
    pub allowed_roots: Arc<RwLock<HashSet<PathBuf>>>,
    pub cache_dir: PathBuf,
    pub db: Arc<Database>,
    pub password_cache: Arc<PasswordCache>,
    pub extract_locks: Arc<DashMap<String, Arc<tokio::sync::Mutex<()>>>>,
}
```

**Rationale**: Tests can exercise `archive_service` without spinning up Axum or Tauri. Handlers become trivial adapters. Future changes (e.g., folder thumbnails) plug into `thumbnail_service` without touching HTTP code.

**Alternatives considered:**
- Shared traits with dependency injection — overkill for this size; concrete structs in service modules are enough.
- Keep logic in `archive_commands.rs`, have Axum call into it — bad because command functions take `AppHandle` which Axum doesn't have.

### 4. Unified SQLite schema: `sources` + `thumbnails` + `extracted`

**Decision**: Replace `archives`/`thumbnails` with three tables where `sources.kind` discriminates archive vs folder.

```sql
sources (
  id                    INTEGER PRIMARY KEY,
  kind                  TEXT NOT NULL CHECK(kind IN ('archive', 'folder')),
  origin_path           TEXT UNIQUE NOT NULL,   -- archive file path or folder root
  identity_segment      TEXT NOT NULL,          -- last path segment (filename for archive, dir name for folder)
  size_hint             INTEGER,                -- archive: file size; folder: NULL
  content_hash          TEXT NOT NULL,          -- archive: path+size+mtime; folder: derived from path only
  is_solid              BOOLEAN DEFAULT FALSE,
  is_pinned             BOOLEAN DEFAULT FALSE,
  entry_count           INTEGER,
  thumb_cache_size      INTEGER DEFAULT 0,
  extracted_cache_size  INTEGER DEFAULT 0,
  policy_override       TEXT,                   -- JSON or NULL
  last_accessed         TIMESTAMP,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sources_migration ON sources(identity_segment, size_hint);

thumbnails (
  id          INTEGER PRIMARY KEY,
  source_id   INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  entry_path  TEXT NOT NULL,
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  thumb_path  TEXT NOT NULL,                    -- relative to cache root
  file_size   INTEGER,
  UNIQUE(source_id, entry_path, width)
);

extracted (
  id            INTEGER PRIMARY KEY,
  source_id     INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  entry_path    TEXT NOT NULL,
  extract_path  TEXT NOT NULL,
  file_size     INTEGER NOT NULL,
  last_accessed TIMESTAMP,
  UNIQUE(source_id, entry_path)
);

passwords (
  archive_path TEXT PRIMARY KEY,
  password     TEXT NOT NULL,
  encrypted    BOOLEAN DEFAULT FALSE
);
```

**Folder identity**: Folders use the absolute path as identity, not a content hash. `content_hash = hash(origin_path)`. `identity_segment` = the last path segment (e.g., `collection` for `D:/packs/collection/`), serving the same migration-detection role as the filename for archives.

**Why only path for folders**: A folder's contents change constantly (add/remove images, rename). Tying cache validity to a content hash would invalidate it on every change — pointless. Cache entries in the `thumbnails` / `extracted` tables are keyed by `entry_path` relative to the folder; stale rows are reconciled incrementally by the scan pipeline (a future change), not by blanket invalidation.

**Rationale**: One set of tables, one migration-detection algorithm, one cache-clearing path. Pin/whitelist logic applies symmetrically. `policy_override` as JSON keeps the schema lean vs. exploding into per-policy columns.

### 5. Cache policy: application default + per-source override

**Decision**: Flat policy struct with optional overrides per source.

```typescript
interface CachePolicy {
  extracted: {
    mode: "no-cache" | "lru-capped" | "unlimited";
    maxSizePerSource?: number;   // bytes; required when mode = "lru-capped"
    minFileSize?: number;        // bytes; entries smaller than this skip caching entirely
  };
  thumbnails: {
    retain: "until-source-removed" | "lru-capped";
    maxTotalSize?: number;       // bytes; required when retain = "lru-capped"
  };
}

interface Settings {
  // existing...
  cachePolicy: CachePolicy;
  thumbnailSizes: number[];      // e.g. [400, 800, 1600]
}
```

Per-source override stored in `sources.policy_override` as `Partial<CachePolicy>`. Resolution at runtime: `effective = { ...global, ...override }`.

**`no-cache` semantics**: Extract to a tempfile scoped to the request, serve bytes, delete when response completes. Never touch the `extracted` table. Useful for users who want to preserve disk space but accept per-view extraction cost.

**`minFileSize` semantics**: Extract normally for the current request, serve bytes, then **do not persist** to `extracted` cache if below threshold. Small files are cheap to re-extract.

**Rationale**: Users' disk-budget and performance preferences vary dramatically (a 16GB laptop with SSD cares about size; a workstation with 4TB HDD doesn't). Per-source override handles the case where one pathological archive needs different treatment than the rest.

### 6. Concurrent extraction coordination

**Decision**: Per-entry `Arc<Mutex<()>>` in a `DashMap<String, Arc<Mutex<()>>>` keyed by `(source_hash, entry_hash)`.

```rust
async fn resolve_original(state: &AppState, uri: &str) -> Result<Bytes> {
    let key = format!("{}:{}", source_hash, entry_hash);
    let lock = state.extract_locks
        .entry(key.clone())
        .or_insert_with(|| Arc::new(Mutex::new(())))
        .clone();
    let _guard = lock.lock().await;

    // Check cache; if hit, return. Else extract, persist, return.
}
```

**Rationale**: Two viewer requests for the same entry must extract once. `DashMap` gives per-key locking without a global RwLock. Locks are never removed from the map (tiny memory overhead, simpler than refcounting with cleanup).

**Alternative**: A central `tokio::sync::Notify` keyed by entry — more complex, no clear advantage.

### 7. Cache directory layout

```
<app-data>/cache/
  thumbs/<source-hash>/<entry-hash>_<width>.webp
  extracted/<source-hash>/<entry-hash>.<ext>
  cache.db
```

`source-hash` is the hex-encoded `content_hash` from the `sources` table. `entry-hash` is a hash of the entry path (same scheme as before).

**Rationale**: Grouping by `source-hash` lets us delete one source's entire cache with a single `remove_dir_all`. Segregating `thumbs/` and `extracted/` lets the two policies operate independently.

### 8. Removing `extract_archive_entry`

**Decision**: Delete the Tauri command and the `PlatformService.extractArchiveEntry` method entirely.

**Rationale**: It was dead code (nothing called it from the frontend), its return type (filesystem path string) was unusable by the webview anyway, and the replacement (Axum handler calling `archive_service`) serves the same purpose without path leakage.

### 9. Web platform stubs

**Decision**: `WebPlatformService` implements `getThumbUrl` as a no-op returning empty string (or throws), and `ImageBatch` entries from web never include `thumbnails`.

**Rationale**: Web has no archive support and no thumbnail cache. The rendering code path works correctly because `srcSet` is `undefined`, `src=getImageUrl(source)` resolves to the existing blob URL.

## Risks / Trade-offs

- **[Breaking schema change]** → The archive cache feature has not shipped to end users. Mitigation: on first launch after upgrade, detect the old schema version and wipe `cache.db` plus `archive-cache/` directory. Log a one-time info message. No UX impact.

- **[Webview can't speak `archive://` or `mg-thumb://` directly]** → These are frontend-internal identifiers, never emitted as `<img src>`. Mitigation: `PlatformService` always converts them to `http://127.0.0.1:PORT/...` URLs before they reach the DOM. Enforced by typing (only platform methods produce URLs).

- **[Extraction-on-HTTP-request blocks response]** → First viewer open for a large entry holds the HTTP response until extraction completes. Mitigation: acceptable in-scope; streaming extraction is a future optimization. The per-entry lock prevents duplicate work under concurrent requests.

- **[`no-cache` extraction creates/deletes many tempfiles]** → Churny disk I/O for users who pick this mode. Mitigation: document the trade-off; use `tempfile` crate for automatic cleanup.

- **[`DashMap` of locks grows unbounded]** → Each unique entry ever requested leaves behind an entry in `extract_locks`. Mitigation: entries are tiny (`Arc<Mutex<()>>` ~ 24 bytes); at realistic usage (100k unique entries) total overhead is ~2.4MB. Acceptable. Revisit if it becomes a problem.

- **[`policy_override` as JSON string]** → Loses schema typing at DB level. Mitigation: validate on read; typed through the Rust struct; never edited by hand. Benefit of schema simplicity outweighs the cost.

- **[Frontend bugs where old call sites still pass `archive://` to `getImageUrl` expecting thumbnails]** → Zero such sites exist today because the old code *also* called `getImageUrl` and got thumbnails accidentally — meaning the viewer's "broken" behavior will start returning originals instead. Mitigation: this *is* the bug fix; no additional handling needed.

## Migration Plan

1. **Upgrade path**: On first launch of the new version:
   - Detect if `cache.db` exists with the old schema (check for `archives` table or absent schema-version row).
   - If yes: close connection, `remove_dir_all` the `archive-cache/` directory, log once at info level.
   - Create fresh database with new schema.
   - No user action required; no setting data lost (settings live in the Tauri store, not SQLite).
2. **Rollback**: Not applicable — the old schema was never in a released version. If ever needed, reverting the code reverts the schema (at the cost of another fresh cache).

## Open Questions

- None blocking. Any remaining questions (e.g., exact `thumbnailSizes` defaults, exact error shapes surfaced to the UI for extraction failures) can be decided during implementation.
