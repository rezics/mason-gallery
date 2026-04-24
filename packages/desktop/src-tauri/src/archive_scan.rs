//! Parallel archive-scan pipeline.
//!
//! The inner loop of `scan_archive` — extract → decode → resize → encode → DB
//! insert — is CPU-bound. On a multi-core machine, serializing it leaves most
//! cores idle and produces the visible "stuck at 0/N" stall when opening a
//! large archive. This module runs that work across a pool of worker threads
//! and reassembles the results back into the archive's sort order before
//! emitting them to the caller.
//!
//! ## Design
//!
//! - **Work distribution**: `AtomicUsize` cursor into a shared
//!   `Arc<Vec<ArchiveEntry>>`. Each worker calls `fetch_add(1)` to claim its
//!   next entry — lock-free, self-balancing, no central dispatcher.
//! - **Completion signalling**: `std::sync::mpsc` channel. Each worker sends
//!   `(source_index, Result)` back to the consumer. We use `std::sync::mpsc`
//!   rather than tokio's channel because the core pipeline is synchronous;
//!   keeping it sync means the benchmark (a plain `#[test]`) can drive it
//!   without bringing up a tokio runtime. In production, `scan_archive`
//!   wraps the whole call in `tokio::task::spawn_blocking`.
//! - **Ordered reassembly**: `BTreeMap<usize, Slot>` + monotonic
//!   `next_index`. Workers complete out of order; the consumer drains
//!   contiguous runs and hands them to `on_batch` in archive-sort order, so
//!   the masonry grid never sees a shuffled arrival stream.
//! - **Errors** (decode failure, password mismatch, I/O): consumed silently
//!   but still advance the reassembly cursor, so a single poison entry
//!   can't deadlock the drain loop waiting on an index that will never
//!   arrive.
//!
//! ## `workers == 0`
//!
//! Fully serial execution on the calling thread — no channels, no spawns, no
//! synchronization. This is the Phase-0 / Phase-1 benchmark baseline; in
//! production we always use a non-zero worker count
//! (`min(available_parallelism(), 8)`).

use crate::archive::{compute_entry_hash, ArchiveEntry, ArchiveReader};
use crate::commands::{WImage, WThumbnail};
use crate::database::Database;
use crate::services::thumbnail_service::{StageTimings, ThumbnailService};

use std::collections::{BTreeMap, HashSet};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::time::Instant;

/// Result of processing a single archive entry. `timings` is zeroed when every
/// requested width was already cached (i.e. no thumbnail generation ran).
pub struct EntryOutcome {
    pub image: WImage,
    pub timings: StageTimings,
}

/// Per-entry work unit: extract the entry's bytes, generate any missing
/// thumbnails, assemble the `WImage` descriptor. Pure function — no Tauri
/// handles, no event emission — so it's reusable from both production scan
/// paths and the benchmark harness.
#[allow(clippy::too_many_arguments)]
pub fn process_entry(
    reader: &dyn ArchiveReader,
    password: Option<&str>,
    entry: &ArchiveEntry,
    archive_path: &str,
    db: &Database,
    thumbnail_svc: &ThumbnailService,
    source_id: i64,
    source_hash: &str,
    widths: &[u32],
) -> Result<EntryOutcome, String> {
    let entry_hash = compute_entry_hash(&entry.path);

    let existing = db
        .get_thumbnails_by_entry(source_id, &entry.path)
        .unwrap_or_default();
    let existing_widths: HashSet<u32> = existing.iter().map(|t| t.width).collect();
    let missing: Vec<u32> = widths
        .iter()
        .copied()
        .filter(|w| !existing_widths.contains(w))
        .collect();

    let mut all_thumbs: Vec<WThumbnail> = existing
        .iter()
        .map(|t| WThumbnail {
            source: ThumbnailService::build_uri(source_hash, &entry_hash, t.width),
            width: t.width,
            height: t.height,
        })
        .collect();

    let mut width_hint: Option<u32> = existing.iter().map(|t| t.width).max();
    let mut height_hint: Option<u32> =
        existing.iter().max_by_key(|t| t.width).map(|t| t.height);

    let mut timings = StageTimings::default();

    if !missing.is_empty() {
        let data = reader
            .extract_entry_to_memory(&entry.path, password)
            .map_err(|e| format!("{}", e))?;

        let (generated, t) = thumbnail_svc.generate_for_entry_timed(
            source_id,
            source_hash,
            &entry.path,
            &data,
            &missing,
            None,
        )?;
        timings = t;

        for g in &generated {
            all_thumbs.push(WThumbnail {
                source: ThumbnailService::build_uri(source_hash, &entry_hash, g.width),
                width: g.width,
                height: g.height,
            });
            if width_hint.map(|w| g.width > w).unwrap_or(true) {
                width_hint = Some(g.width);
                height_hint = Some(g.height);
            }
        }
    }

    all_thumbs.sort_by_key(|t| t.width);
    all_thumbs.dedup_by_key(|t| t.width);

    let image = WImage {
        source: format!("archive:///{}#{}", archive_path, entry.path),
        relative_path: entry.path.clone(),
        width: width_hint,
        height: height_hint,
        thumbnails: Some(all_thumbs),
        source_id: Some(source_id),
        locked: None,
    };

    Ok(EntryOutcome { image, timings })
}

/// Slot in the reassembly buffer. `Errored` is a tombstone that advances the
/// cursor without emitting anything.
enum Slot {
    Present(WImage),
    Errored,
}

/// Reassembly buffer: feeds (index, result) pairs in arbitrary order, drains
/// in monotonically-increasing source order starting from 0.
///
/// Isolated from the worker/channel machinery so it can be unit-tested with
/// deterministic synthetic inputs (see `tests` below).
pub struct OrderedReassembly {
    next_index: usize,
    buffer: BTreeMap<usize, Slot>,
}

impl OrderedReassembly {
    pub fn new() -> Self {
        Self {
            next_index: 0,
            buffer: BTreeMap::new(),
        }
    }

    /// Insert a successfully processed entry at `idx`. Returns any newly
    /// contiguous images that can be emitted (possibly empty, possibly
    /// several if this insertion unblocks a run).
    pub fn insert_ok(&mut self, idx: usize, image: WImage) -> Vec<WImage> {
        self.buffer.insert(idx, Slot::Present(image));
        self.drain()
    }

    /// Mark an index as failed — the cursor still advances past it, but
    /// nothing is emitted for that slot.
    pub fn insert_err(&mut self, idx: usize) -> Vec<WImage> {
        self.buffer.insert(idx, Slot::Errored);
        self.drain()
    }

    fn drain(&mut self) -> Vec<WImage> {
        let mut out = Vec::new();
        while let Some(slot) = self.buffer.remove(&self.next_index) {
            if let Slot::Present(img) = slot {
                out.push(img);
            }
            self.next_index += 1;
        }
        out
    }
}

impl Default for OrderedReassembly {
    fn default() -> Self {
        Self::new()
    }
}

/// Configuration for a scan run.
///
/// `workers == 0` means "run serially on the calling thread" — used only by
/// the benchmark harness for Phase-0 / Phase-1 baseline numbers. Production
/// always passes a positive worker count.
pub struct ScanConfig {
    pub workers: usize,
    pub page_size: usize,
}

/// Aggregated results across all entries.
pub struct ScanSummary {
    pub stage_totals: StageTimings,
    pub entries_processed: usize,
    pub thumbs_generated: usize,
    /// Wall-time ns spent in `process_entry` per successfully-processed
    /// entry. In parallel mode these overlap in real time, so summing them
    /// exceeds wall-clock — the benchmark uses these for per-entry p50/p95
    /// only.
    pub per_entry_ns: Vec<u64>,
}

/// Inputs to a scan run. Clones cheaply (everything is `Arc`) so each worker
/// holds its own handle.
pub struct ScanInputs {
    pub reader: Arc<dyn ArchiveReader>,
    pub password: Option<String>,
    pub entries: Arc<Vec<ArchiveEntry>>,
    pub archive_path: Arc<String>,
    pub db: Arc<Database>,
    pub thumbnail_svc: Arc<ThumbnailService>,
    pub source_id: i64,
    pub source_hash: Arc<String>,
    pub widths: Arc<Vec<u32>>,
}

/// Run the archive scan. Batches are emitted via `on_batch` in archive-sort
/// order; the final batch (possibly empty) is emitted with `done == true`.
///
/// Errors on individual entries are swallowed silently (matches current
/// production behavior — one corrupt image shouldn't poison a whole scan);
/// only the reassembly cursor advances.
pub fn run_scan<F>(
    inputs: ScanInputs,
    cfg: ScanConfig,
    mut on_batch: F,
) -> ScanSummary
where
    F: FnMut(Vec<WImage>, bool),
{
    let mut summary = ScanSummary {
        stage_totals: StageTimings::default(),
        entries_processed: 0,
        thumbs_generated: 0,
        per_entry_ns: Vec::with_capacity(inputs.entries.len()),
    };
    let mut batch_buffer: Vec<WImage> = Vec::with_capacity(cfg.page_size.max(1));

    let push_and_maybe_flush =
        |images: Vec<WImage>, buf: &mut Vec<WImage>, on_batch: &mut F| {
            for img in images {
                buf.push(img);
                if buf.len() >= cfg.page_size {
                    let drained = std::mem::take(buf);
                    on_batch(drained, false);
                    buf.reserve(cfg.page_size);
                }
            }
        };

    if cfg.workers == 0 {
        // Serial, on the calling thread. Already in source order, no
        // reassembly needed.
        for entry in inputs.entries.iter() {
            let t0 = Instant::now();
            match process_entry(
                &*inputs.reader,
                inputs.password.as_deref(),
                entry,
                &inputs.archive_path,
                &inputs.db,
                &inputs.thumbnail_svc,
                inputs.source_id,
                &inputs.source_hash,
                &inputs.widths,
            ) {
                Ok(outcome) => {
                    summary.per_entry_ns.push(t0.elapsed().as_nanos() as u64);
                    summary.stage_totals.add(&outcome.timings);
                    summary.entries_processed += 1;
                    summary.thumbs_generated +=
                        outcome.image.thumbnails.as_ref().map(|v| v.len()).unwrap_or(0);
                    push_and_maybe_flush(
                        vec![outcome.image],
                        &mut batch_buffer,
                        &mut on_batch,
                    );
                }
                Err(_) => continue,
            }
        }
    } else {
        // Parallel: worker pool + AtomicUsize cursor + mpsc back to consumer.
        let (tx, rx) = mpsc::channel::<(usize, Result<(EntryOutcome, u64), ()>)>();
        let cursor = Arc::new(AtomicUsize::new(0));
        let total = inputs.entries.len();

        let mut handles = Vec::with_capacity(cfg.workers);
        for _ in 0..cfg.workers {
            let reader = inputs.reader.clone();
            let password = inputs.password.clone();
            let entries = inputs.entries.clone();
            let archive_path = inputs.archive_path.clone();
            let db = inputs.db.clone();
            let thumbnail_svc = inputs.thumbnail_svc.clone();
            let source_hash = inputs.source_hash.clone();
            let widths = inputs.widths.clone();
            let source_id = inputs.source_id;
            let cursor = cursor.clone();
            let tx = tx.clone();

            handles.push(std::thread::spawn(move || loop {
                let idx = cursor.fetch_add(1, Ordering::Relaxed);
                if idx >= total {
                    break;
                }
                let entry = &entries[idx];
                let t0 = Instant::now();
                let result = process_entry(
                    &*reader,
                    password.as_deref(),
                    entry,
                    &archive_path,
                    &db,
                    &thumbnail_svc,
                    source_id,
                    &source_hash,
                    &widths,
                );
                let ns = t0.elapsed().as_nanos() as u64;
                match result {
                    Ok(outcome) => {
                        let _ = tx.send((idx, Ok((outcome, ns))));
                    }
                    Err(_) => {
                        let _ = tx.send((idx, Err(())));
                    }
                }
            }));
        }
        // Drop the producer-side sentinel so rx closes once all worker
        // clones finish.
        drop(tx);

        let mut reassembly = OrderedReassembly::new();
        for (idx, res) in rx.iter() {
            let ready = match res {
                Ok((outcome, ns)) => {
                    summary.per_entry_ns.push(ns);
                    summary.stage_totals.add(&outcome.timings);
                    summary.entries_processed += 1;
                    summary.thumbs_generated +=
                        outcome.image.thumbnails.as_ref().map(|v| v.len()).unwrap_or(0);
                    reassembly.insert_ok(idx, outcome.image)
                }
                Err(_) => reassembly.insert_err(idx),
            };
            push_and_maybe_flush(ready, &mut batch_buffer, &mut on_batch);
        }

        for h in handles {
            let _ = h.join();
        }
    }

    // Final flush — always emit the sentinel, even if the buffer is empty,
    // so the consumer sees a `done: true` batch to close out the scan.
    on_batch(batch_buffer, true);

    summary
}

/// Default worker count for production: at least 1, at most 8. The cap
/// reflects the sweet spot observed in the Phase-2 worker-scaling sweep
/// (see `bench-phase-2.md`): beyond 8 workers, contention on I/O + the
/// SQLite writer mutex overtakes parallel decode/resize gains.
pub fn default_worker_count() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(2)
        .clamp(1, 8)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stub_image(relative_path: &str) -> WImage {
        WImage {
            source: format!("archive:///stub#{}", relative_path),
            relative_path: relative_path.to_string(),
            width: None,
            height: None,
            thumbnails: None,
            source_id: None,
            locked: None,
        }
    }

    /// Synthetic test: feed indices in scrambled order, assert that the
    /// drained output emerges in 0..N order. Simulates what the parallel
    /// worker pool does when multiple threads finish in non-deterministic
    /// order.
    #[test]
    fn ordered_reassembly_out_of_order_insertion() {
        let mut r = OrderedReassembly::new();

        // Insert in scrambled order: 2, 0, 4, 1, 3.
        let r1 = r.insert_ok(2, stub_image("c"));
        assert!(r1.is_empty(), "2 alone shouldn't drain — 0 is missing");

        let r2 = r.insert_ok(0, stub_image("a"));
        assert_eq!(
            r2.iter().map(|i| i.relative_path.as_str()).collect::<Vec<_>>(),
            vec!["a"],
            "0 alone drains only 0 (1 still missing)"
        );

        let r3 = r.insert_ok(4, stub_image("e"));
        assert!(r3.is_empty(), "4 alone shouldn't drain — 1, 2, 3 missing");

        let r4 = r.insert_ok(1, stub_image("b"));
        assert_eq!(
            r4.iter().map(|i| i.relative_path.as_str()).collect::<Vec<_>>(),
            vec!["b", "c"],
            "inserting 1 should drain 1 and 2 (2 was buffered)"
        );

        let r5 = r.insert_ok(3, stub_image("d"));
        assert_eq!(
            r5.iter().map(|i| i.relative_path.as_str()).collect::<Vec<_>>(),
            vec!["d", "e"],
            "inserting 3 should drain 3 and 4 (4 was buffered)"
        );
    }

    /// Errored slots advance the cursor but don't emit.
    #[test]
    fn ordered_reassembly_skips_errored_indices() {
        let mut r = OrderedReassembly::new();

        assert!(r.insert_ok(2, stub_image("c")).is_empty());
        assert_eq!(
            r.insert_err(0).len(),
            0,
            "error at 0 advances past but emits nothing (1 still missing)"
        );
        let drained = r.insert_err(1);
        assert_eq!(
            drained.iter().map(|i| i.relative_path.as_str()).collect::<Vec<_>>(),
            vec!["c"],
            "after skipping errored 0 and 1, buffered 2 must drain"
        );
    }

    #[test]
    fn ordered_reassembly_in_order_insertion() {
        let mut r = OrderedReassembly::new();
        let paths = ["a", "b", "c", "d"];
        let mut emitted: Vec<String> = Vec::new();
        for (i, p) in paths.iter().enumerate() {
            for img in r.insert_ok(i, stub_image(p)) {
                emitted.push(img.relative_path);
            }
        }
        assert_eq!(emitted, vec!["a", "b", "c", "d"]);
    }

    #[test]
    fn default_worker_count_is_bounded() {
        let n = default_worker_count();
        assert!((1..=8).contains(&n), "worker count out of [1,8]: {}", n);
    }
}
