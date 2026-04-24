//! Archive-scan throughput benchmark.
//!
//! An `#[ignore]`-gated integration test that measures end-to-end wall time of
//! the per-entry archive-scan pipeline (list → extract → decode → resize →
//! encode → DB insert) against a real sample archive. It replicates the inner
//! loop of `scan_archive` but instruments per-stage timings, skips event
//! emission (no Tauri runtime is booted), and uses fresh temporary DB + cache
//! directories for every invocation so cache hits cannot contaminate numbers
//! across runs.
//!
//! # Configuration
//!
//! All knobs are environment variables. Defaults match the Phase-0 baseline
//! scenario (single 800-px width, serial, against the sample archive
//! referenced in the change proposal).
//!
//! | Variable              | Default                                                          | Meaning                                                                      |
//! | --------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
//! | `MASON_BENCH_ARCHIVE` | `C:\Users\edge\Pictures\测试图集-压缩\测试图集-压缩.zip`           | Path to the archive under test                                               |
//! | `MASON_BENCH_WIDTHS`  | `800`                                                            | Comma-separated thumbnail widths                                             |
//! | `MASON_BENCH_WORKERS` | `archive_scan::default_worker_count()`                           | Parallel workers (production default `min(available_parallelism(),8)`; `0` = fully serial baseline) |
//! | `MASON_BENCH_WARMUP`  | `1`                                                              | Warmup runs (not measured)                                                   |
//! | `MASON_BENCH_RUNS`    | `3`                                                              | Timed runs                                                                   |
//!
//! Pass `MASON_BENCH_WORKERS=0` for the Phase-0 / Phase-1 serial baseline.
//! Any positive value engages the parallel worker pool via
//! `archive_scan::run_scan`.
//!
//! # Running
//!
//! ```
//! # Phase 0 (baseline): serial, three widths
//! MASON_BENCH_WIDTHS=400,800,1600 MASON_BENCH_WORKERS=0 \
//!   cargo test --release --package mason-gallery --test bench_archive_scan \
//!   -- --ignored --nocapture
//!
//! # Phase 1 (single-width, still serial)
//! MASON_BENCH_WIDTHS=800 MASON_BENCH_WORKERS=0 \
//!   cargo test --release --package mason-gallery --test bench_archive_scan \
//!   -- --ignored --nocapture
//!
//! # Phase 2 (single-width, parallel) — requires Group 4 refactor
//! MASON_BENCH_WIDTHS=800 MASON_BENCH_WORKERS=8 \
//!   cargo test --release --package mason-gallery --test bench_archive_scan \
//!   -- --ignored --nocapture
//! ```
//!
//! # Interpreting output
//!
//! - **Wall time (median / p95)**: total seconds per run across `RUNS` trials.
//! - **Per-entry p50 / p95**: sum of (decode+resize+encode+db) timings per
//!   entry, sorted across all entries of the final timed run.
//! - **Per-stage breakdown**: aggregated decode / resize / encode / db ms
//!   across all entries of the final timed run. Their sum should be within
//!   ~10% of total wall time in serial mode (sanity check that
//!   instrumentation captures most of the real work).
//! - **Throughput**: `entries_processed / wall_seconds` for the median run.
//! - **Entry-order check**: the test asserts the collected entry list is in
//!   the archive's natural-sorted order; any regression in parallel emit
//!   causes a test failure with a diff of the first mismatch.

use mason_gallery_lib::archive::{open_archive, ArchiveEntry, ArchiveReader};
use mason_gallery_lib::archive_scan::{self, ScanConfig, ScanInputs};
use mason_gallery_lib::database::Database;
use mason_gallery_lib::services::source_service::SourceService;
use mason_gallery_lib::services::thumbnail_service::{StageTimings, ThumbnailService};

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

const DEFAULT_ARCHIVE: &str = r"C:\Users\edge\Pictures\测试图集-压缩\测试图集-压缩.zip";
const DEFAULT_WIDTHS: &str = "800";
/// Default worker count = production default (`min(available_parallelism(), 8)`).
/// Pass `MASON_BENCH_WORKERS=0` explicitly to run the serial baseline.
const DEFAULT_WARMUP: &str = "1";
const DEFAULT_RUNS: &str = "3";

const IMAGE_EXTS: &[&str] = &["jpg", "jpeg", "png", "gif", "webp", "bmp"];

struct BenchConfig {
    archive: PathBuf,
    widths: Vec<u32>,
    workers: usize,
    warmup: usize,
    runs: usize,
}

impl BenchConfig {
    fn from_env() -> Self {
        let archive = std::env::var("MASON_BENCH_ARCHIVE")
            .unwrap_or_else(|_| DEFAULT_ARCHIVE.to_string());
        let widths_raw = std::env::var("MASON_BENCH_WIDTHS")
            .unwrap_or_else(|_| DEFAULT_WIDTHS.to_string());
        let workers: usize = std::env::var("MASON_BENCH_WORKERS")
            .ok()
            .map(|s| {
                s.parse()
                    .expect("MASON_BENCH_WORKERS must be a non-negative integer")
            })
            .unwrap_or_else(mason_gallery_lib::archive_scan::default_worker_count);
        let warmup: usize = std::env::var("MASON_BENCH_WARMUP")
            .unwrap_or_else(|_| DEFAULT_WARMUP.to_string())
            .parse()
            .expect("MASON_BENCH_WARMUP must be a non-negative integer");
        let runs: usize = std::env::var("MASON_BENCH_RUNS")
            .unwrap_or_else(|_| DEFAULT_RUNS.to_string())
            .parse()
            .expect("MASON_BENCH_RUNS must be a positive integer");

        let widths: Vec<u32> = widths_raw
            .split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(|s| {
                s.parse::<u32>()
                    .unwrap_or_else(|_| panic!("Invalid width in MASON_BENCH_WIDTHS: {}", s))
            })
            .collect();
        assert!(!widths.is_empty(), "MASON_BENCH_WIDTHS must have at least one value");
        assert!(runs >= 1, "MASON_BENCH_RUNS must be at least 1");

        Self {
            archive: PathBuf::from(archive),
            widths,
            workers,
            warmup,
            runs,
        }
    }
}

struct RunResult {
    wall: Duration,
    stage_totals: StageTimings,
    per_entry_ns: Vec<u64>,
    entry_count: usize,
    thumb_count: usize,
    emitted_order: Vec<String>,
}

/// Execute one benchmark iteration: fresh tempdir, scan the archive, collect
/// per-entry + per-stage timings, return results. The tempdir is dropped at
/// the end of this function (i.e. between iterations) — this simulates a
/// cold-cache run every time.
fn run_once(cfg: &BenchConfig) -> RunResult {
    let tmp = tempfile::tempdir().expect("failed to create tempdir");
    let cache_dir = tmp.path().join("cache");
    std::fs::create_dir_all(&cache_dir).expect("failed to create cache dir");

    let db = Arc::new(Database::new(&cache_dir).expect("failed to open db"));
    let source_svc = SourceService::new(db.clone());
    let thumb_svc = Arc::new(ThumbnailService::new(db.clone(), cache_dir.clone()));

    let reader = open_archive(&cfg.archive).expect("failed to open archive");
    let entries = reader
        .list_entries(None)
        .expect("failed to list entries");
    let is_solid = reader.is_solid().unwrap_or(false);

    let mut image_entries: Vec<ArchiveEntry> = entries
        .into_iter()
        .filter(|e| {
            if e.is_directory {
                return false;
            }
            let ext = Path::new(&e.path)
                .extension()
                .and_then(|x| x.to_str())
                .map(|x| x.to_lowercase())
                .unwrap_or_default();
            IMAGE_EXTS.iter().any(|e| *e == ext)
        })
        .collect();
    image_entries.sort_by(|a, b| natord::compare(&a.path, &b.path));

    let (source_rec, _) = source_svc
        .open_or_create_archive(
            cfg.archive.to_str().expect("archive path not UTF-8"),
            Some(is_solid),
            Some(image_entries.len() as i64),
        )
        .expect("failed to register source");
    let source_id = source_rec.id;
    let source_hash = source_rec.content_hash.clone();

    let emitted: std::sync::Mutex<Vec<String>> = std::sync::Mutex::new(Vec::with_capacity(image_entries.len()));
    let archive_path_str = cfg
        .archive
        .to_str()
        .expect("archive path not UTF-8")
        .to_string();

    let entry_count = image_entries.len();
    let reader_arc: Arc<dyn ArchiveReader> = Arc::from(reader);
    let inputs = ScanInputs {
        reader: reader_arc,
        password: None,
        entries: Arc::new(image_entries),
        archive_path: Arc::new(archive_path_str),
        db: db.clone(),
        thumbnail_svc: thumb_svc,
        source_id,
        source_hash: Arc::new(source_hash),
        widths: Arc::new(cfg.widths.clone()),
    };
    let scan_cfg = ScanConfig {
        workers: cfg.workers,
        page_size: 50,
    };

    let wall_start = Instant::now();
    let summary = archive_scan::run_scan(inputs, scan_cfg, |images, _done| {
        let mut e = emitted.lock().expect("emitted mutex poisoned");
        for img in images {
            e.push(img.relative_path);
        }
    });
    let wall = wall_start.elapsed();

    let emitted_order = emitted.into_inner().expect("emitted mutex poisoned");

    RunResult {
        wall,
        stage_totals: summary.stage_totals,
        per_entry_ns: summary.per_entry_ns,
        entry_count,
        thumb_count: summary.thumbs_generated,
        emitted_order,
    }
}

fn pct(sorted: &[u64], p: f64) -> u64 {
    if sorted.is_empty() {
        return 0;
    }
    let idx = ((sorted.len() as f64 - 1.0) * p).round() as usize;
    sorted[idx.min(sorted.len() - 1)]
}

fn ns_to_ms(ns: u64) -> f64 {
    ns as f64 / 1_000_000.0
}

fn fmt_ms(ns: u64) -> String {
    format!("{:>8.2} ms", ns_to_ms(ns))
}

#[test]
#[ignore = "benchmark; run with --ignored"]
fn bench_archive_scan() {
    let cfg = BenchConfig::from_env();

    assert!(
        cfg.archive.exists(),
        "Sample archive not found at {}. Set MASON_BENCH_ARCHIVE to override.",
        cfg.archive.display()
    );

    println!("=== mason-gallery archive-scan benchmark ===");
    println!("archive : {}", cfg.archive.display());
    println!("widths  : {:?}", cfg.widths);
    println!("workers : {} ({})", cfg.workers, if cfg.workers == 0 { "serial" } else { "parallel" });
    println!("warmup  : {}", cfg.warmup);
    println!("runs    : {}", cfg.runs);
    println!();

    // --- warmup ---
    for i in 0..cfg.warmup {
        let r = run_once(&cfg);
        println!(
            "[warmup {}] wall={:.2}s entries={} thumbs={}",
            i + 1,
            r.wall.as_secs_f64(),
            r.entry_count,
            r.thumb_count
        );
    }

    // --- timed runs ---
    let mut results: Vec<RunResult> = Vec::with_capacity(cfg.runs);
    for i in 0..cfg.runs {
        let r = run_once(&cfg);
        println!(
            "[run {}/{}] wall={:.2}s entries={} thumbs={}",
            i + 1,
            cfg.runs,
            r.wall.as_secs_f64(),
            r.entry_count,
            r.thumb_count
        );
        results.push(r);
    }
    println!();

    // --- entry-order assertion (run on every timed run) ---
    for (i, r) in results.iter().enumerate() {
        let mut expected = r.emitted_order.clone();
        expected.sort_by(|a, b| natord::compare(a, b));
        assert_eq!(
            r.emitted_order, expected,
            "run {} emitted entries out of source sort order; first mismatch: \
             got={:?} expected={:?}",
            i + 1,
            r.emitted_order.iter().zip(expected.iter()).find(|(a, b)| a != b),
            expected.iter().find(|e| !r.emitted_order.contains(e)),
        );
    }

    // --- aggregated stats (across timed runs) ---
    let mut wall_ns: Vec<u64> = results
        .iter()
        .map(|r| r.wall.as_nanos() as u64)
        .collect();
    wall_ns.sort_unstable();
    let wall_median = pct(&wall_ns, 0.5);
    let wall_p95 = pct(&wall_ns, 0.95);

    // Per-entry breakdown is reported from the final timed run (stable shape).
    let last = results.last().expect("at least one run");
    let mut per_entry_sorted = last.per_entry_ns.clone();
    per_entry_sorted.sort_unstable();
    let entry_p50 = pct(&per_entry_sorted, 0.5);
    let entry_p95 = pct(&per_entry_sorted, 0.95);

    let stage = &last.stage_totals;
    let captured_ns = stage.decode_ns + stage.resize_ns + stage.encode_ns + stage.db_ns;

    let wall_secs = last.wall.as_secs_f64();
    let throughput = if wall_secs > 0.0 {
        last.entry_count as f64 / wall_secs
    } else {
        0.0
    };

    println!("=== RESULTS ===");
    println!("wall median : {:.3}s", ns_to_ms(wall_median) / 1000.0);
    println!("wall p95    : {:.3}s", ns_to_ms(wall_p95) / 1000.0);
    println!("entries     : {}", last.entry_count);
    println!("thumbnails  : {}", last.thumb_count);
    println!("per-entry p50: {}", fmt_ms(entry_p50));
    println!("per-entry p95: {}", fmt_ms(entry_p95));
    println!();
    println!("--- per-stage (sums across all entries, last timed run) ---");
    println!("  decode   : {}", fmt_ms(stage.decode_ns));
    println!("  resize   : {}", fmt_ms(stage.resize_ns));
    println!("  encode   : {}", fmt_ms(stage.encode_ns));
    println!("  db       : {}", fmt_ms(stage.db_ns));
    println!("  captured : {}", fmt_ms(captured_ns));
    println!(
        "  wall     : {} ({:.1}% captured)",
        fmt_ms(last.wall.as_nanos() as u64),
        (captured_ns as f64 / last.wall.as_nanos() as f64) * 100.0
    );
    println!();
    println!("throughput  : {:.2} entries/sec", throughput);
}
