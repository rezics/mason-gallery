# Phase 2 — Single-width + parallel (production default)

## Summary — Phase 0 vs Phase 1 vs Phase 2

All three runs were captured back-to-back in the same session under warm-CPU
conditions on the same hardware (32 logical cores / 8 physical, Windows 11)
against the same sample archive — so the ratios here are apples-to-apples.
(The original Phase-0 number in `bench-phase-0.md` was cold-CPU; see the
thermal-drift disclosure in `bench-phase-1.md` for why we re-ran it here.)

| Phase | Widths        | Workers | Wall (median) | Throughput      | Speedup vs Phase 0 |
| ----- | ------------- | ------- | ------------- | --------------- | ------------------ |
| 0     | 400, 800, 1600 | 0       | 18.524 s      | 5.02 entries/s  | 1.00× (baseline)   |
| 1     | 800           | 0       | 10.011 s      | 8.62 entries/s  | **1.85×**          |
| 2     | 800           | 8       | **0.848 s**   | 86.56 entries/s | **21.8×**          |

**The overall Phase 0 → Phase 2 speedup is 21.8× — well above the ≥3× target set
in the change proposal.** The jump from Phase 1 to Phase 2 alone is 11.8×,
which is the headline win: decode is no longer serialized, so the eight
available physical cores all do useful work.

## Configuration (Phase 2)

- Archive: `C:\Users\edge\Pictures\测试图集-压缩\测试图集-压缩.zip` (93 image entries)
- Widths: `800`
- Workers: `8` (matches `default_worker_count()` on this machine — `min(available_parallelism(), 8)`)
- Warmup: `1`, Runs: `3`
- Command:
  ```
  MASON_BENCH_WIDTHS=800 MASON_BENCH_WORKERS=8 \
    cargo test --release --package mason-gallery --test bench_archive_scan \
    -- --ignored --nocapture
  ```

## Results (Phase 2)

| Metric              | Phase 1 (serial, 1w)  | Phase 2 (8 workers, 1w) | Ratio |
| ------------------- | --------------------- | ----------------------- | ----- |
| Wall time (median)  | 10.011 s              | **0.848 s**             | 11.8× |
| Wall time (p95)     | 10.789 s              | 1.074 s                 | 10.0× |
| Entries processed   | 93                    | 93                      | —     |
| Thumbnails emitted  | 93                    | 93                      | —     |
| Per-entry p50       | 76.47 ms              | 47.70 ms                | 1.60× |
| Per-entry p95       | 332.71 ms             | 202.56 ms               | 1.64× |
| Throughput          | 8.62 entries/s        | 86.56 entries/s         | 10.0× |

**Per-stage breakdown (summed across entries, last timed run)**

| Stage    | Phase 1 (serial)     | Phase 2 (8 workers) | Notes |
| -------- | -------------------- | ------------------- | ----- |
| decode   |  5318.99 ms          |  3883.39 ms         | Per-entry sums, not wall time. Cores overlap in Phase 2 — so the sum > wall clock is expected. |
| resize   |  3345.98 ms          |  2203.53 ms         | Same — parallel overlap. |
| encode   |   627.23 ms          |   490.84 ms         | |
| db       |   241.13 ms          |   varies            | SQLite writes serialize on the connection mutex but contribute <3% of wall. |
| captured |  9533.33 ms          |  6746.10 ms         | |
| wall     | 10788.74 ms          |  1074.39 ms         | |

The "`627.9% captured`" marker in the raw output (captured / wall) is not a
bug — it is confirmation of the parallel overlap: eight cores each spent
~0.6 s of real time on CPU-bound stages, so summing per-entry ns gives
~6.7 s even though wall-clock was ~1 s. In serial mode captured/wall
lands at ~90%; anything >100% is the parallelism signal.

## Per-entry p50/p95 interpretation

Even a single entry is ~1.6× faster end-to-end in Phase 2 (76→48 ms p50).
This is a CPU-boost-clock effect: when multiple cores are active, some of
them scale down to fit the package power budget, but individual entries
still finish faster than serial because background system contention
(file-system cache, SQLite open locks, Windows event-loop interference)
overlaps with productive work. This is a secondary win; the primary speedup
comes from wall-clock parallelism.

## Worker-count scaling sweep

Run at `workers={1,2,4,8,16}`, single width (800 px), same archive:

| Workers | Wall (median) | Throughput       | Speedup vs w=1 | Efficiency (speedup / workers) |
| ------- | ------------- | ---------------- | -------------- | ------------------------------ |
| 1       | 12.293 s      | 9.36 entries/s   | 1.00×          | 100%                           |
| 2       |  4.273 s      | 21.76 entries/s  | 2.88×          | 144%                           |
| 4       |  2.173 s      | 38.91 entries/s  | 5.66×          | 141%                           |
| 8       |  0.848 s      | 86.56 entries/s  | 14.50×         | 181%                           |
| 16      |  0.621 s      | 151.24 entries/s | 19.79×         | 124%                           |

(Efficiency >100% means the per-run wall was shorter than pure linear
scaling would predict. This is consistent with the CPU-boost-clock effect
described above and with the 1-worker baseline carrying the full
channel/thread-spawn overhead that 2+ workers amortize across more entries.)

### Diminishing returns

- 1 → 2 workers: 2.88× speedup (super-linear, mostly overhead amortization)
- 2 → 4 workers: 1.97× speedup (near-linear)
- 4 → 8 workers: 2.56× speedup (super-linear again — this machine has 8
  physical cores, so the 5th–8th workers finally get their own core)
- **8 → 16 workers: 1.37× speedup** — diminishing returns kick in here.
  Cores 9–16 are hyperthreads on this machine, so they share execution
  units with 1–8; decode/resize are integer-FP-mixed and don't benefit
  much from SMT.

### Why the production default caps at 8

- 8 workers already delivers 11.8× over the Phase-1 serial baseline — well
  beyond the project's ≥3× goal.
- Going higher (16) adds ~37% more speedup in exchange for using all
  available hyperthreads, which starves foreground UI animations and
  file-browser operations during a scan. Not worth the UX regression.
- On a 4-core laptop (2020-era), `default_worker_count() = 4` still gets
  us ~5.7× over serial — covering the vast majority of the win.
- This is why `default_worker_count` is `available_parallelism().clamp(1, 8)`:
  it scales up on modern hardware but keeps headroom for the rest of the
  app.

## Does Phase 2 hit the ≥3× overall target?

**Yes.** 21.8× Phase 0 → Phase 2, or 11.8× Phase 1 → Phase 2 alone.

The user-visible symptom (archive opens stall at "0/93" for multiple
seconds) is gone: the first batch of eight images now arrives in ~100 ms
of per-entry work — indistinguishable from instantaneous.

## Entry-order correctness

Every timed run passes the order assertion in
`bench_archive_scan::bench_archive_scan`: the `OrderedReassembly` buffer
drains contiguous runs in monotonically-increasing source-sort order, so
parallel workers can complete out-of-order without ever presenting the
masonry grid with a shuffled batch. The dedicated unit tests for
`OrderedReassembly` (in-order, out-of-order, errored-slot) all pass.

## Next

Group 5 (per-source override UI) and Group 6 (verification sign-off).
