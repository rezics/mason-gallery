## 1. Benchmark Harness (Phase 0 — Baseline)

- [x] 1.1 Create `packages/desktop/src-tauri/tests/bench_archive_scan.rs` with `#[ignore]`-gated test
- [x] 1.2 Write module-level doc comments: purpose, env-var configuration table, how to run, how to interpret output
- [x] 1.3 Implement env-var parsing for `MASON_BENCH_ARCHIVE`, `MASON_BENCH_WIDTHS`, `MASON_BENCH_WORKERS`, `MASON_BENCH_WARMUP`, `MASON_BENCH_RUNS` with documented defaults
- [x] 1.4 Implement tempdir construction (fresh SQLite DB + fresh cache dir per invocation; cleanup on test exit)
- [x] 1.5 Wire up service construction (`archive_service`, `thumbnail_service`, `source_service`) against the tempdir state
- [x] 1.6 Implement timing harness: warmup runs (not measured), then `N` timed runs; collect total wall time per run
- [x] 1.7 Implement per-stage instrumentation: track `decode_ms`, `resize_ms`, `encode_ms`, `db_ms` summed across entries (add `Instant::now()` pairs inside `thumbnail_service::generate_for_entry` or use a `tracing`-based scope)
- [x] 1.8 Implement reporting: print median + p95 wall time, per-entry p50/p95, per-stage breakdown, throughput, entry count, thumbnail count
- [x] 1.9 Implement entry-order assertion: collect emitted entries, compare to expected sorted order, fail loudly if out of order
- [x] 1.10 Verify test runs end-to-end against the sample archive (`C:\Users\edge\Pictures\测试图集-压缩\测试图集-压缩.zip`) with current (unchanged) code
- [x] 1.11 **Phase 0 data collection**: run benchmark with `MASON_BENCH_WIDTHS=400,800,1600` and `MASON_BENCH_WORKERS=0` (serial) on the sample archive; record baseline numbers (median wall time, per-entry p50/p95, per-stage breakdown) in a new file `openspec/changes/thumbnail-scan-perf/bench-phase-0.md`

## 2. Width Resolution Unification

- [x] 2.1 Extend `CachePolicy` (Rust) with `thumbnail_sizes: Vec<u32>` field; default stays `[400, 800, 1600]` for backwards-compat of pre-migration users — actual default for fresh installs is set on the frontend
- [x] 2.2 Extend `setCachePolicy` command payload to accept `thumbnail_sizes`; persist into the shared policy state
- [x] 2.3 Add `ThumbnailOverride.widths: Option<Vec<u32>>` field in `services/policy.rs`; update serde serialization (field is additive in JSON, forward-compatible with existing rows)
- [x] 2.4 Add `policy::resolve_widths(source, global) -> Vec<u32>` function: `source.policy_override.thumbnails.widths.unwrap_or(global.thumbnail_sizes)`
- [x] 2.5 Add validation in `set_source_policy`: reject any override whose `thumbnails.widths` is `Some([])`; return a descriptive error
- [x] 2.6 Update `archive_commands.rs::scan_archive` to call `resolve_widths` instead of accepting widths from the frontend payload; remove widths from `ScanArchiveParams` (or keep and deprecate with a warning)
- [x] 2.7 Update `commands.rs::scan_directory` inline-archive expansion to call `resolve_widths` for each archive source (remove hardcoded `default_widths()` reference)
- [x] 2.8 Update `commands.rs::request_thumbnail` to call `resolve_widths` instead of using the frontend-passed widths hint (frontend hint may remain as an override escape hatch, but default path SHALL use resolved widths)
- [x] 2.9 Update `WebPlatformService.setCachePolicy` and `TauriPlatformService.setCachePolicy` TS signatures to include `thumbnail_sizes`
- [x] 2.10 Update `settingsStore.setThumbnailSizes` to call `setCachePolicy` with the updated list (so Rust stays authoritative)
- [x] 2.11 Extend `SourceOverride` TS type (`core/src/types/platform.ts`) with optional `thumbnails.widths?: number[]`
- [x] 2.12 Write Rust unit tests for `resolve_widths` (source override present, source override absent, global empty fallback)

## 3. Default Single-Width Switch

- [x] 3.1 Change `settingsStore.ts` default `thumbnailSizes` from `[400, 800, 1600]` to `[800]`
- [x] 3.2 Update `SettingsDrawer` helper text for `thumbnailSizes` to mention the quality/perf tradeoff and the new default
- [x] 3.3 Add frontend validation in `SettingsDrawer.commitThumbSizes`: at least one value required, all values positive integers ≤ 4096
- [x] 3.4 Verify persisted settings of existing users remain untouched (they keep their current array)
- [ ] 3.5 Manually verify a fresh archive open now generates a single thumbnail per entry at 800 px *(deferred to Group 6 verification)*
- [x] 3.6 **Phase 1 data collection**: re-run benchmark with `MASON_BENCH_WIDTHS=800` and `MASON_BENCH_WORKERS=0` (still serial) on the sample archive; record numbers in `openspec/changes/thumbnail-scan-perf/bench-phase-1.md`; compute `phase-0 / phase-1` ratio and confirm ≥3× wall-time reduction — **observed 2.21× (short of 3× target, see bench-phase-1.md for why); ≥3× will come with Phase 2 parallelism**

## 4. Parallel Entry Processing

- [x] 4.1 Verify `PRAGMA journal_mode=WAL` is set in `database.rs` initialization; enable if missing *(already enabled, `database.rs:40`)*
- [x] 4.2 Refactor `archive_commands.rs::scan_archive` inner loop into a producer-consumer structure using ~~tokio channels~~ `std::sync::mpsc` channels *(sync channel chosen over tokio channel because the per-entry pipeline is CPU-bound and the benchmark harness is a plain sync `#[test]` — kept the whole core sync and wrapped in `tokio::task::spawn_blocking` from the Tauri command; see module doc in `archive_scan.rs`)*
- [x] 4.3 Implement worker pool: `default_worker_count() = available_parallelism().clamp(1, 8)` workers, each invoking the per-entry extract + thumbnail pipeline via `archive_scan::process_entry` inside `std::thread::spawn`; the whole scan runs inside `tokio::task::spawn_blocking` so the Tauri event loop stays responsive
- [x] 4.4 Implement ordered reassembly buffer (`OrderedReassembly`): `BTreeMap<usize, Slot>` + `next_index` cursor; `Slot::Errored` tombstones advance the cursor without emitting so one failed entry can't deadlock the drain loop
- [x] 4.5 Implement flush logic: emit `images:batch` when batch buffer reaches `page_size` or on producer completion (final batch always flushed with `done: true`, even if empty)
- [x] 4.6 Honor `MASON_BENCH_WORKERS=0` override: the same `archive_scan::run_scan` function branches on `workers == 0` to a serial path with no channels, no thread spawns, no synchronization — production always passes a non-zero count
- [x] 4.7 Unit tests for `OrderedReassembly` (in-order, out-of-order, errored-slot): all pass (`cargo test --lib archive_scan::`)
- [ ] 4.8 Verify integration: open a real archive in the desktop app, confirm images arrive in the expected order (no visual misplacement in the masonry grid) *(deferred to Group 6 manual verification)*
- [x] 4.9 **Phase 2 data collection**: benchmark at `MASON_BENCH_WIDTHS=800 MASON_BENCH_WORKERS=8` recorded in `bench-phase-2.md` — observed **11.8× wall-time reduction** over Phase 1 (target was ≥2×) and **21.8× over Phase 0** (target was ≥3×). The "0/N stall" user complaint is resolved.
- [x] 4.10 **Sweep** at `MASON_BENCH_WORKERS=1,2,4,8,16`: scaling curve in `bench-phase-2.md`. Diminishing returns kick in at `workers > 8` on a machine with 8 physical cores + 16 hyperthreads — 8 → 16 yields only 1.37× additional speedup (vs 4 → 8 which yields 2.56×). Default cap of 8 is justified: captures ~73% of the maximum observable speedup on this hardware while keeping CPU headroom for foreground UI work.

## 5. Per-Source Override UI (Optional for Performance Win, Required for Spec Compliance)

- [x] 5.1 Located existing per-source override UI: `packages/core/src/pages/CachePage.tsx::CustomizeDialog`
- [x] 5.2 Added widths-array editor (comma-separated `TextField`) below the existing `thumbnailMaxTotalSize` field in the same dialog — reuses the same parse/validate pattern as `SettingsDrawer.commitThumbSizes`
- [x] 5.3 Validation: values must be finite positive integers ≤ 4096; empty/invalid input simply drops the override (falls back to global); dedup via `new Set` before save
- [x] 5.4 `buildOverride()` now attaches `thumbnails.widths` when at least one valid value is parsed; `onSave` → `platform.setSourcePolicy` flows through unchanged (already JSON-serializes the full override)
- [x] 5.5 Effective-policy preview block now shows `thumbnailSizes: [...]` reflecting the merged result (source override ∪ global)
- [ ] 5.6 Manually verify: set an override of `[400, 800, 1600]` for one source, open it, confirm `<img srcSet>` contains three candidates; set back to empty/null, confirm single 800-px thumbnail *(deferred to Group 6 manual verification)*

## 6. Verification & Sign-Off

- [x] 6.1 Run `bun run check` (biome + tsc) — **exit 0**; two pre-existing biome warnings in `TauriPlatformService.ts` (optional-chain suggestion) unrelated to this change
- [x] 6.2 Run `cargo check` and `cargo clippy` in `packages/desktop/src-tauri/` — **both exit 0**; zero new warnings on `archive_scan.rs` or touched files (all 13 clippy warnings pre-existed in `services/policy.rs`, `password.rs`, `server.rs`)
- [x] 6.3 Run full `cargo test` (benchmark remains `#[ignore]`d) — **passes**; 1 benchmark test ignored by design, all library unit tests (including `archive_scan::tests`) green
- [ ] 6.4 Manually open a locked archive, unlock, verify thumbnails generate at the new default width *(deferred — requires live desktop app; covered by integration-level correctness via benchmark harness which exercises the same `run_scan` code path with the resolved widths)*
- [ ] 6.5 Manually scan a folder containing loose images + an inline archive, verify both honor the global `thumbnailSizes` *(deferred — requires live desktop app; `resolve_widths` unit tests (task 2.12) cover both paths, and `commands.rs::scan_directory` + `archive_commands.rs::scan_archive` both call it)*
- [x] 6.6 Compile phase-0, phase-1, phase-2 results into a single summary at the top of `bench-phase-2.md` — done; summary table shows **21.8× Phase 0 → Phase 2** (well beyond the ≥3× target)
- [x] 6.7 Confirm all spec requirements from `specs/**/*.md` have a corresponding implemented and verified task — **matrix below**:
  - `rust-file-engine/spec.md`:
    - *Scan archive command* (resolved widths + parallel + order) → tasks 2.6, 4.2–4.6 ✓
    - *Parallel entry processing* → 4.2, 4.3, 4.6 ✓
    - *Ordered reassembly buffer* (including final flush with `done:true`) → 4.4, 4.5, 4.7 ✓
    - *Folder scan width resolution* → 2.7, 2.8 ✓
  - `settings-panel/spec.md`:
    - *Cache policy settings section* (default `[800]`, helper text, Rust sync) → 3.1, 3.2, 3.3, 2.9, 2.10 ✓
    - *Per-source policy override UI* (incl. "empty widths override blocked in UI" via `widthsError` → disables Save) → 5.2–5.5 ✓
  - `sources-cache/spec.md`:
    - *Per-source policy override* (incl. empty-widths rejection in `set_source_policy`) → 2.3, 2.5, 2.12 ✓
    - *Unified width resolution across scan paths* → 2.4, 2.6, 2.7, 2.8, 2.12 ✓
    - *Global thumbnail sizes synced to Rust via cache policy* → 2.1, 2.2, 2.9, 2.10 ✓
  - `thumbnail-generation-benchmark/spec.md`:
    - *Archive-scan benchmark integration test* (`#[ignore]`-gated) → 1.1, 1.10 ✓
    - *Env-var configuration* (incl. "workers = num_cpus" default) → 1.3 ✓ — `MASON_BENCH_WORKERS` unset falls back to `archive_scan::default_worker_count()`
    - *Isolated fresh state per run* → 1.4 ✓
    - *Measurement and reporting* → 1.6, 1.7, 1.8 ✓
    - *Entry-order verification under parallelism* → 1.9 + 4.7 ✓
  - `thumbnail-protocol/spec.md`:
    - *ImageEntry carries multi-resolution thumbnails* → no direct task needed; pre-existing shape, now populated via resolved widths at every emit site (tasks 2.6, 2.7) ✓
  - Deferred items 6.4 and 6.5 are live-app sanity checks that duplicate logic already covered by the benchmark harness, `archive_scan::tests`, and `resolve_widths` unit tests; they are not spec scenarios but extra belt-and-suspenders manual passes to run before archiving the change.
