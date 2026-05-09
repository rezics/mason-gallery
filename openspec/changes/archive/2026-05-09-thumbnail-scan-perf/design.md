## Context

Opening an archive of ~90 entries stalls at `0/93` in the progress UI for several seconds before any image appears. The CPU is not actually busy — the pipeline is artificially serial and over-provisioned with work that the UI cannot consume.

Current state (traced in `archive_commands.rs`, `thumbnail_service.rs`, `commands.rs`):

- `scan_archive` iterates entries in a single tokio task. Inside the loop: fetch entry bytes → decode once → serially loop over `widths = [400, 800, 1600]` → resize + encode WebP per width → insert three rows into `thumbnails`. First `images:batch` is only flushed after `page_size` entries complete all three encodes.
- `scan_directory` hard-codes `default_widths()` in `commands.rs:169` and ignores the user's `thumbnailSizes` setting entirely. Lazy folder thumbnails also fall back to `default_widths()` when the frontend passes an empty array.
- `WaterfallGrid` builds an `<img srcSet>` from all widths in `WImage.thumbnails[]`; the browser picks one per `cellWidth × DPR`.
- `sources.policy_override` is a `TEXT` column holding a JSON-serialized `CachePolicyOverride { extracted, thumbnails }`. `ThumbnailOverride` currently has only `retain` and `max_total_size` — no per-source width override exists.
- `settingsStore.ts:67` defaults `thumbnailSizes = [400, 800, 1600]`. `setCachePolicy` already syncs the broader cache policy to Rust, but widths are passed per-scan-call rather than held in Rust as a resolved authoritative value.

Stakeholder: the app is primarily used to view image packs. Power users who stream originals through the viewer and only need a thumbnail for grid preview benefit most from cutting scan cost. HiDPI-grid users may notice slight softening if only one width is generated.

## Goals / Non-Goals

**Goals:**
- Cut archive-scan wall time to first batch by roughly `3×` via single-width default, and another `~N×` via entry-level parallelism (N = worker count).
- Make width resolution consistent across archive scans, folder scans, and lazy requests.
- Let power users opt into multiple widths globally or per source.
- Establish a reproducible Rust benchmark so before/after claims are backed by numbers, not vibes.
- Preserve grid sort order under parallel scan.

**Non-Goals:**
- Redesigning the top bar or adding a thumbnail-progress UI (user decided this is unnecessary once the underlying pipeline is fast).
- Changing the thumbnail format (remains WebP).
- Per-entry width parallelism (when we drop to one width, this is moot).
- Changing the `images:batch` / `images:count` / `images:thumbnails` event shapes.
- Migrating existing users' persisted `thumbnailSizes` setting — their choice is respected.

## Decisions

### D1: Default `thumbnailSizes = [800]`, keep `number[]` shape

Single width of 800 px balances HiDPI responsiveness (good enough for a 2× 400-px grid cell, which is the typical case) against decode/encode cost (`3×` saving vs baseline).

Kept as `number[]` rather than scalar because:
- Existing persisted settings of power users are arrays — scalar would force a migration.
- The UI control (`SettingsDrawer`'s comma-separated text field) already edits arrays.
- Opting into 2–3 widths for quality-sensitive sources is a legitimate use case and trivially supported.

**Alternative considered — collapse to scalar `thumbnailSize: number`**: Rejected. Saves ~5 lines and gains nothing meaningful; forces breaking change on users who already customized to `[400, 800, 1600]`.

### D2: Per-source width override lives in `ThumbnailOverride.widths`

Add an optional `widths: Vec<u32>` field to the Rust `ThumbnailOverride` struct (serialized into `sources.policy_override`). Frontend mirror: extend `SourceOverride.thumbnails` with an optional `widths: number[]`. The effective width list for any operation on a source is:

```
effective_widths =
    source.policy_override.thumbnails.widths
    ?? global_settings.thumbnailSizes
```

Validation: `widths`, when present, MUST be non-empty. Empty arrays are rejected at the `set_source_policy` boundary — they would cause the grid to render only originals, which is slower than serving a single thumbnail. (Users who truly want "no thumbnails" can already set `folderThumbnails: "off"` for folders; archives are always expected to have at least one thumbnail.)

**Alternative considered — new top-level field `sources.thumbnail_widths_override`**: Rejected. The policy_override JSON blob is the established extension point for per-source configuration. Coexisting with `retain` and `max_total_size` under the same `thumbnails` object is conceptually clean.

**Alternative considered — per-source full `thumbnailSizes` replacement only (no merge)**: The "merge" semantics here are trivial — widths is scalar-like (the whole array is replaced), not deep-merged. This matches how `retain` is already handled. Noted explicitly to avoid confusion.

### D3: Unified width-resolution function in Rust

Introduce `policy::resolve_widths(source: &SourceRow, global: &CachePolicy) -> Vec<u32>` used by:
- `archive_commands.rs::scan_archive` (currently accepts widths from frontend — will switch to resolving via source id)
- `commands.rs::scan_directory` (for inline-expanded archives during folder walks)
- `commands.rs::request_thumbnail` (lazy pipeline)

Global `thumbnailSizes` must therefore be known to Rust. It is attached to the existing `cache_policy` that `setCachePolicy` syncs — the cache-policy sync already fires on settings changes, so no new IPC round-trip is needed. `setCachePolicy` payload grows one field.

**Alternative considered — keep passing widths per scan call from frontend**: Rejected. Creates three parallel "pick the widths" code paths (frontend for archive, hardcoded for folder, frontend with fallback for lazy). Centralizing in Rust eliminates the silent inconsistency the user flagged.

### D4: Parallel entry processing with ordered emission

Replace the serial per-entry loop in `scan_archive` with a bounded `tokio::task::spawn_blocking` pool. Structure:

```
entries ──▶ channel ──▶ N workers ──▶ ordered reassembly buffer ──▶ batch flush ──▶ emit
             (bounded)  (spawn_blocking)  (small heap keyed by index)  (page_size)
```

Concretely:
- Worker count: `min(num_cpus::get(), 8)` — caps the pool to avoid hammering disks/contention on lower-tier CPUs. Exposed via the benchmark env var to allow sweeping.
- Each worker decodes + generates thumbnails for one entry at the resolved single (or multi) width.
- Completed entries are inserted into a small `BTreeMap<usize, CompletedEntry>` keyed by original sort index. A "next expected index" cursor drains contiguous results and pushes them to a `page_size` batch buffer; flush when full or when the producer signals done.
- This preserves the invariant that `images:batch` arrives in source-sort order (the grid relies on this).

**Alternative considered — parallel + unordered emit (sort client-side)**: Rejected. The grid's incremental positioner assumes batches arrive pre-sorted; reshuffling would break scroll-position stability.

**Alternative considered — `rayon::par_iter` instead of `spawn_blocking`**: `spawn_blocking` integrates with the existing tokio runtime and the lazy-thumbnail worker already uses it — consistency wins. Rayon would also work but introduces a second runtime to reason about.

**SQLite write contention**: Multiple workers writing to `thumbnails` concurrently will benefit from `PRAGMA journal_mode=WAL`. Verify it is already enabled in `database.rs`; if not, enable it. If WAL is present, concurrent writes are serialized by SQLite internally with minimal contention at our scale (N ≤ 8 workers, a few rows each).

### D5: Benchmark harness — Rust integration test, env-var configured

File: `packages/desktop/src-tauri/tests/bench_archive_scan.rs`. `#[ignore]` by default — runs only via explicit `cargo test -- --ignored`.

Configuration via environment variables:

| Var | Default | Purpose |
|---|---|---|
| `MASON_BENCH_ARCHIVE` | `C:\Users\edge\Pictures\测试图集-压缩\测试图集-压缩.zip` | Archive path |
| `MASON_BENCH_WIDTHS` | `800` | Comma-separated widths |
| `MASON_BENCH_WORKERS` | `num_cpus` | Parallel worker count (0 = serial baseline) |
| `MASON_BENCH_WARMUP` | `1` | Warmup runs before measurement |
| `MASON_BENCH_RUNS` | `3` | Timed runs; reports median and p95 |

Each run constructs a fresh in-memory / tempdir SQLite database and a fresh tempdir for the thumbnail cache so cache hits don't skew results. Timings reported:

- Total wall time (primary metric)
- Per-entry p50 / p95
- Breakdown: decode_ms / resize_ms / encode_ms / db_ms (summed across entries)
- Throughput: entries/sec, source bytes decoded/sec
- N entries, M thumbnails generated

Module-level doc comments describe:
- Purpose (what this benchmark measures)
- Configuration table (above)
- How to run (`cargo test --release --package mason-gallery --test bench_archive_scan -- --ignored --nocapture`)
- How to interpret output

**Alternative considered — `criterion` crate**: Adds a dev-dep and is oriented toward microbenchmarks with statistical rigor. Overkill for a "did this optimization actually help" check on a single real archive. A plain integration test with `std::time::Instant` is simpler and sufficient.

## Risks / Trade-offs

**[Softer previews on HiDPI large-grid displays]** → A single 800-px thumbnail rendered into a 2× 600-px cell (= 1200 effective pixels) will be upscaled slightly. Mitigation: default of 800 covers the common 2× 400-px case; power users and per-source override can opt into additional widths. The viewer (full image) is unaffected — it always serves originals.

**[Parallel workers exposing SQLite write contention]** → If WAL is not enabled, concurrent inserts may serialize heavily. Mitigation: verify / enable `PRAGMA journal_mode=WAL` during startup. If contention remains measurable (visible in benchmark's `db_ms`), batch inserts per worker or funnel DB writes through a single writer task.

**[Sort-order bug under parallel emit]** → If the ordered reassembly buffer has a bug, batches emit out of order and the grid mis-positions. Mitigation: unit test the reassembly logic in isolation with synthetic entries; integration-check via the benchmark (it asserts entry order after full scan).

**[Benchmark path is Windows-specific]** → `C:\Users\edge\Pictures\...` is not portable. Mitigation: env var override; a repo-relative default fallback (e.g., `tests/fixtures/sample.zip`) will be added once a suitable small fixture is committed. For now the env var is mandatory on non-developer machines, and the default is purely for local iteration.

**[Users with persisted `thumbnailSizes=[400, 800, 1600]` don't feel the speedup]** → The default change only affects fresh installs and users who haven't customized. Users with the old default persisted still pay the 3× cost. Mitigation: documented in release notes; per-source override gives them a migration path without forcing a reset of their global preference.

**[Folder-scan change affects users who relied on the hardcoded default]** → Previously folder scans always used `[400, 800, 1600]`. After this change they honor the user's setting (single width by default). Practically a consistency fix, but it means someone who explicitly set `thumbnailSizes=[400]` and relied on folders still getting 3 widths will now get one. Acceptable — the prior behavior was a silent inconsistency, not an intended feature.

## Migration Plan

1. Ship the benchmark harness first (Phase 0 measurement). Records baseline timings for the sample archive on the developer's machine.
2. Ship single-width default + width-resolution unification (Phase 1). Re-run benchmark; confirm ≥3× wall-time improvement.
3. Ship parallel entry processing (Phase 2). Re-run benchmark; confirm additional ≥2× improvement.
4. Per-source override UI is not required for the performance win — it's infrastructure delivery. Ship it alongside Phase 1.

Rollback: If parallelism introduces sort-order bugs in production, gate it behind a setting (`archiveScanWorkers: number`, default 1) that degrades cleanly to serial. The setting is the env-var knob made persistent. Not adding preemptively — only if field issues surface.

## Open Questions

- Is `PRAGMA journal_mode=WAL` already set in `database.rs` initialization? (Needs a one-line check during implementation — if not, enable it.)
- Should the benchmark also measure `scan_directory` (folder with inline archives), or is archive-only sufficient for this change? (Leaning archive-only since folder scan's per-entry cost is dominated by IO, not thumbnail work — but revisit if folder scans also feel slow after Phase 2.)
