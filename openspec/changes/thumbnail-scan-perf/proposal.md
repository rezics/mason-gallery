## Why

Opening a 93-entry archive stalls at `0/93` for a long time before any image appears, even though the Rust backend is not actually CPU-saturated. Two issues compound into the visible lag: (1) every entry is decoded once and then serially re-encoded as WebP at three widths (`[400, 800, 1600]`), so the real per-entry cost is roughly `3×` what users perceive as "one thumbnail", and (2) the per-entry loop runs serially — no parallelism between entries — so the first batch cannot be emitted until the first chunk of entries finishes all three encodes. A masonry grid only needs one thumbnail per cell at a time, so the multi-width default is paying HiDPI responsiveness we rarely get back.

## What Changes

- **BREAKING**: Change the default `thumbnailSizes` setting from `[400, 800, 1600]` to `[800]`. Users who want more widths can still opt in; per-project override is available for archives that want higher-quality previews.
- Extend per-source `CachePolicyOverride.thumbnails` with a `widths?: u32[]` field so an individual source (a "project") can override the global width list. Empty arrays are rejected — a source must generate at least one width.
- Parallelize the archive scan entry loop with a bounded `spawn_blocking` worker pool (default: `num_cpus`), while preserving the original sort order when emitting `images:batch` events.
- Fix the silent inconsistency where folder scans (`commands.rs::scan_directory`) and lazy thumbnail requests hard-code `default_widths()` and ignore the user's `thumbnailSizes` setting. All three paths (archive scan, folder scan, lazy request) resolve widths via the same precedence: `source.policy_override.thumbnails.widths ?? global.thumbnailSizes`.
- Add a Rust integration benchmark (`tests/bench_archive_scan.rs`) that measures archive-scan throughput end-to-end, configurable via environment variables, with a documented three-phase data-collection plan (baseline → single-width → parallel). Phase measurements are recorded as implementation tasks so the change's value can be verified with real numbers.

## Capabilities

### New Capabilities

- `thumbnail-generation-benchmark`: Rust integration test harness that measures archive-scan performance on a configurable sample archive, with env-var configuration, warmup runs, and per-stage timing breakdown (decode / resize / encode / db).

### Modified Capabilities

- `thumbnail-protocol`: Default width list changes to `[800]`; all scan paths (archive, folder, lazy) must resolve widths through the same `source-override-or-global` precedence.
- `sources-cache`: `CachePolicyOverride.thumbnails` adds an optional `widths: u32[]` field; empty arrays are rejected at the API boundary.
- `rust-file-engine`: Archive scan emits batches from a bounded parallel worker pool instead of a serial loop; sort order is preserved on emit.
- `settings-panel`: Thumbnail sizes setting UI documents the new default and the per-source override mechanism.

## Impact

- **Rust**: `archive_commands.rs` (parallel worker pool, width resolution), `commands.rs` (folder scan width resolution), `services/thumbnail_service.rs` (unchanged per-width generation, but called via worker), `services/policy.rs` (add `widths` field + validation), `database.rs` (migration for `policy_override` JSON shape is additive — no schema change, just a new optional field in the stored JSON).
- **Frontend**: `stores/settingsStore.ts` default value change, `SettingsDrawer` validator guards against empty arrays, `types/platform.ts` updates `SourceOverride` type to include `widths`.
- **User-visible**: Archive previews may look softer on HiDPI displays with very wide grid cells until the user opts into multiple widths. Disk usage drops because only one thumbnail is stored per entry by default.
- **Performance target**: Benchmark should show ≥3× wall-time reduction from Phase 0 to Phase 1, and ≥2× additional reduction from Phase 1 to Phase 2, on the sample archive (`C:\Users\edge\Pictures\测试图集-压缩\测试图集-压缩.zip`).
- **Back-compat**: Existing sources with no `widths` override continue to work; the field is optional. Users with a persisted `thumbnailSizes = [400, 800, 1600]` setting are not migrated — their setting is respected.
- **No DB migration required**: `policy_override` is already a `TEXT` JSON column; adding an optional field to the serialized struct is forward-compatible.
