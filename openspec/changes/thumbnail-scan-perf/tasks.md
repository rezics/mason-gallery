## 1. Benchmark Harness (Phase 0 — Baseline)

- [ ] 1.1 Create `packages/desktop/src-tauri/tests/bench_archive_scan.rs` with `#[ignore]`-gated test
- [ ] 1.2 Write module-level doc comments: purpose, env-var configuration table, how to run, how to interpret output
- [ ] 1.3 Implement env-var parsing for `MASON_BENCH_ARCHIVE`, `MASON_BENCH_WIDTHS`, `MASON_BENCH_WORKERS`, `MASON_BENCH_WARMUP`, `MASON_BENCH_RUNS` with documented defaults
- [ ] 1.4 Implement tempdir construction (fresh SQLite DB + fresh cache dir per invocation; cleanup on test exit)
- [ ] 1.5 Wire up service construction (`archive_service`, `thumbnail_service`, `source_service`) against the tempdir state
- [ ] 1.6 Implement timing harness: warmup runs (not measured), then `N` timed runs; collect total wall time per run
- [ ] 1.7 Implement per-stage instrumentation: track `decode_ms`, `resize_ms`, `encode_ms`, `db_ms` summed across entries (add `Instant::now()` pairs inside `thumbnail_service::generate_for_entry` or use a `tracing`-based scope)
- [ ] 1.8 Implement reporting: print median + p95 wall time, per-entry p50/p95, per-stage breakdown, throughput, entry count, thumbnail count
- [ ] 1.9 Implement entry-order assertion: collect emitted entries, compare to expected sorted order, fail loudly if out of order
- [ ] 1.10 Verify test runs end-to-end against the sample archive (`C:\Users\edge\Pictures\测试图集-压缩\测试图集-压缩.zip`) with current (unchanged) code
- [ ] 1.11 **Phase 0 data collection**: run benchmark with `MASON_BENCH_WIDTHS=400,800,1600` and `MASON_BENCH_WORKERS=0` (serial) on the sample archive; record baseline numbers (median wall time, per-entry p50/p95, per-stage breakdown) in a new file `openspec/changes/thumbnail-scan-perf/bench-phase-0.md`

## 2. Width Resolution Unification

- [ ] 2.1 Extend `CachePolicy` (Rust) with `thumbnail_sizes: Vec<u32>` field; default stays `[400, 800, 1600]` for backwards-compat of pre-migration users — actual default for fresh installs is set on the frontend
- [ ] 2.2 Extend `setCachePolicy` command payload to accept `thumbnail_sizes`; persist into the shared policy state
- [ ] 2.3 Add `ThumbnailOverride.widths: Option<Vec<u32>>` field in `services/policy.rs`; update serde serialization (field is additive in JSON, forward-compatible with existing rows)
- [ ] 2.4 Add `policy::resolve_widths(source, global) -> Vec<u32>` function: `source.policy_override.thumbnails.widths.unwrap_or(global.thumbnail_sizes)`
- [ ] 2.5 Add validation in `set_source_policy`: reject any override whose `thumbnails.widths` is `Some([])`; return a descriptive error
- [ ] 2.6 Update `archive_commands.rs::scan_archive` to call `resolve_widths` instead of accepting widths from the frontend payload; remove widths from `ScanArchiveParams` (or keep and deprecate with a warning)
- [ ] 2.7 Update `commands.rs::scan_directory` inline-archive expansion to call `resolve_widths` for each archive source (remove hardcoded `default_widths()` reference)
- [ ] 2.8 Update `commands.rs::request_thumbnail` to call `resolve_widths` instead of using the frontend-passed widths hint (frontend hint may remain as an override escape hatch, but default path SHALL use resolved widths)
- [ ] 2.9 Update `WebPlatformService.setCachePolicy` and `TauriPlatformService.setCachePolicy` TS signatures to include `thumbnail_sizes`
- [ ] 2.10 Update `settingsStore.setThumbnailSizes` to call `setCachePolicy` with the updated list (so Rust stays authoritative)
- [ ] 2.11 Extend `SourceOverride` TS type (`core/src/types/platform.ts`) with optional `thumbnails.widths?: number[]`
- [ ] 2.12 Write Rust unit tests for `resolve_widths` (source override present, source override absent, global empty fallback)

## 3. Default Single-Width Switch

- [ ] 3.1 Change `settingsStore.ts` default `thumbnailSizes` from `[400, 800, 1600]` to `[800]`
- [ ] 3.2 Update `SettingsDrawer` helper text for `thumbnailSizes` to mention the quality/perf tradeoff and the new default
- [ ] 3.3 Add frontend validation in `SettingsDrawer.commitThumbSizes`: at least one value required, all values positive integers ≤ 4096
- [ ] 3.4 Verify persisted settings of existing users remain untouched (they keep their current array)
- [ ] 3.5 Manually verify a fresh archive open now generates a single thumbnail per entry at 800 px
- [ ] 3.6 **Phase 1 data collection**: re-run benchmark with `MASON_BENCH_WIDTHS=800` and `MASON_BENCH_WORKERS=0` (still serial) on the sample archive; record numbers in `openspec/changes/thumbnail-scan-perf/bench-phase-1.md`; compute `phase-0 / phase-1` ratio and confirm ≥3× wall-time reduction

## 4. Parallel Entry Processing

- [ ] 4.1 Verify `PRAGMA journal_mode=WAL` is set in `database.rs` initialization; enable if missing
- [ ] 4.2 Refactor `archive_commands.rs::scan_archive` inner loop into a producer-consumer structure using tokio channels
- [ ] 4.3 Implement worker pool: `min(num_cpus::get(), 8)` workers, each invoking the existing per-entry extract + thumbnail pipeline inside `spawn_blocking`
- [ ] 4.4 Implement ordered reassembly buffer: `BTreeMap<usize, CompletedEntry>` + next-expected-index cursor; drain contiguous runs to the page-size batch buffer
- [ ] 4.5 Implement flush logic: emit `images:batch` when batch buffer reaches `page_size` or on producer completion (final flush with `done: true`)
- [ ] 4.6 Honor `MASON_BENCH_WORKERS=0` override: when set, bypass the worker pool and run serially (used only for benchmark baseline; production always uses the pool)
- [ ] 4.7 Write unit test for the ordered reassembly buffer in isolation: feed synthetic indices out of order, assert output order matches input sort order
- [ ] 4.8 Verify integration: open a real archive in the desktop app, confirm images arrive in the expected order (no visual misplacement in the masonry grid)
- [ ] 4.9 **Phase 2 data collection**: re-run benchmark with `MASON_BENCH_WIDTHS=800` and `MASON_BENCH_WORKERS=num_cpus` on the sample archive; record numbers in `openspec/changes/thumbnail-scan-perf/bench-phase-2.md`; compute `phase-1 / phase-2` ratio and confirm ≥2× additional wall-time reduction
- [ ] 4.10 **Sweep**: run benchmark at `MASON_BENCH_WORKERS=1,2,4,8` and record scaling curve in `bench-phase-2.md`; document the point of diminishing returns so we can justify the default worker cap

## 5. Per-Source Override UI (Optional for Performance Win, Required for Spec Compliance)

- [ ] 5.1 Find existing cache-management / per-source override UI location (likely `packages/core/src/routes/cache.tsx` or a panel in `SettingsDrawer`)
- [ ] 5.2 Add a widths-array editor control to the per-source override panel (reuse the comma-separated TextField pattern from the global setting)
- [ ] 5.3 Wire validation: disallow empty, disallow non-numeric, disallow values > 4096
- [ ] 5.4 Wire `setSourcePolicy` call to include the widths override
- [ ] 5.5 Display the effective widths (after merge) alongside the input
- [ ] 5.6 Manually verify: set an override of `[400, 800, 1600]` for one source, open it, confirm `<img srcSet>` contains three candidates; set back to empty/null, confirm single 800-px thumbnail

## 6. Verification & Sign-Off

- [ ] 6.1 Run `bun run check` (biome + tsc) — must pass
- [ ] 6.2 Run `cargo check` and `cargo clippy` in `packages/desktop/src-tauri/` — must pass with no new warnings
- [ ] 6.3 Run full `cargo test` (benchmark remains `#[ignore]`d) — must pass
- [ ] 6.4 Manually open a locked archive, unlock, verify thumbnails generate at the new default width
- [ ] 6.5 Manually scan a folder containing loose images + an inline archive, verify both honor the global `thumbnailSizes`
- [ ] 6.6 Compile phase-0, phase-1, phase-2 results into a single summary at the top of `bench-phase-2.md` (Phase 0 baseline / Phase 1 single-width / Phase 2 single-width + parallel, with speedup ratios)
- [ ] 6.7 Confirm all spec requirements from `specs/**/*.md` have a corresponding implemented and verified task; note any deferred scenarios
