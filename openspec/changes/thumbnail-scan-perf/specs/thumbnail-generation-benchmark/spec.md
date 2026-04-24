## ADDED Requirements

### Requirement: Archive-scan benchmark integration test
The Rust backend SHALL include a `#[ignore]`-gated integration test at `packages/desktop/src-tauri/tests/bench_archive_scan.rs` that measures end-to-end `scan_archive` wall time on a configurable sample archive. The test SHALL be excluded from the default `cargo test` run and SHALL require explicit `--ignored` invocation.

#### Scenario: Default test run skips benchmark
- **WHEN** a developer runs `cargo test` without `--ignored`
- **THEN** the benchmark test SHALL be reported as "ignored" and SHALL NOT execute

#### Scenario: Explicit benchmark run
- **WHEN** a developer runs `cargo test --release --package mason-gallery --test bench_archive_scan -- --ignored --nocapture`
- **THEN** the benchmark SHALL execute and print timing output

### Requirement: Environment-variable configuration
The benchmark SHALL read its inputs from environment variables with documented defaults. The configuration SHALL include at minimum: archive path (`MASON_BENCH_ARCHIVE`), widths (`MASON_BENCH_WIDTHS`, comma-separated), worker count (`MASON_BENCH_WORKERS`; `0` means serial), warmup runs (`MASON_BENCH_WARMUP`), and timed runs (`MASON_BENCH_RUNS`). The configuration table SHALL be documented in module-level doc comments at the top of the test file.

#### Scenario: All defaults used
- **WHEN** the benchmark runs with no environment variables set
- **THEN** it SHALL use the documented defaults (archive at the developer's sample path, widths `800`, workers = `num_cpus`, warmup = 1, runs = 3)

#### Scenario: Widths overridden
- **WHEN** the benchmark runs with `MASON_BENCH_WIDTHS=400,800,1600`
- **THEN** generated thumbnails SHALL be produced at those three widths for every entry

#### Scenario: Worker count overridden to serial
- **WHEN** the benchmark runs with `MASON_BENCH_WORKERS=0`
- **THEN** archive-scan processing SHALL run one entry at a time with no parallelism

### Requirement: Isolated fresh state per run
Each benchmark invocation SHALL construct a fresh temporary SQLite database and a fresh temporary cache directory, separate from the user's actual app data. The temporary state SHALL be cleaned up after the timed runs complete (or best-effort on test failure). Cache hits from a prior benchmark run SHALL NOT be reused across invocations.

#### Scenario: Tempdirs created and cleaned
- **WHEN** the benchmark runs to completion
- **THEN** the temporary DB and cache directories SHALL be removed before the test exits

#### Scenario: Warmup runs share fresh state
- **WHEN** the benchmark's warmup phase runs
- **THEN** the warmup SHALL use the same temp DB/cache as the subsequent timed runs (so the timed runs measure cache-hit or cache-miss behavior identical to warmup, as applicable)

### Requirement: Measurement and reporting
The benchmark SHALL report the following per invocation: total wall time (median and p95 across timed runs), per-entry p50 and p95, per-stage breakdown (`decode_ms`, `resize_ms`, `encode_ms`, `db_ms`, summed across all entries), throughput as `entries/sec`, count of entries processed, count of thumbnails generated. Output SHALL be plain text printed to stdout via `--nocapture`.

#### Scenario: Report fields present
- **WHEN** the benchmark completes its timed runs
- **THEN** stdout SHALL include lines for each of: total wall time (median, p95), entries processed, thumbnails generated, per-stage timing breakdown, throughput

#### Scenario: Per-stage timing attributed
- **WHEN** the benchmark reports per-stage timing
- **THEN** the sum of `decode_ms + resize_ms + encode_ms + db_ms` SHALL be within 10% of total CPU time spent inside the scan worker pool (sanity check that instrumentation captures most of the real work)

### Requirement: Entry-order verification under parallelism
The benchmark SHALL assert that image entries arrive in source-sort order regardless of worker count. This guards against parallel-emit regressions where completed-first workers could leak out-of-order batches.

#### Scenario: Sort order preserved with multiple workers
- **WHEN** the benchmark runs with `MASON_BENCH_WORKERS>=2` on an archive with `name-asc` sort
- **THEN** the collected entry list in emission order SHALL equal the archive's entries sorted by name ascending
