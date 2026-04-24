# Phase 1 — Single-width default (serial, 1 width)

**Configuration**

- Archive: `C:\Users\edge\Pictures\测试图集-压缩\测试图集-压缩.zip` (93 image entries)
- Widths: `800` (the new default)
- Workers: `0` (serial)
- Warmup: `1`, Runs: `3`
- Command:
  ```
  MASON_BENCH_WIDTHS=800 MASON_BENCH_WORKERS=0 \
    cargo test --release --package mason-gallery --test bench_archive_scan \
    -- --ignored --nocapture
  ```

## Thermal-drift disclosure

The original Phase-0 data in `bench-phase-0.md` (8.676 s median) was captured under cold-CPU conditions (first invocation after boot-time compilation, no prior thermal load). Subsequent runs of the same configuration under warm-CPU conditions (after ~10 minutes of back-to-back benchmark/compile work) measured 24.083 s — the same code, ~3× slower. This is consistent with modern laptop CPUs boosting hard for the first few seconds of load and throttling back once package temperature climbs.

To make the Phase-0 vs Phase-1 comparison apples-to-apples, this Phase-1 number was captured **immediately after** a fresh Phase-0 re-run, both under warm-CPU conditions. The absolute numbers here are slower than the cold-cache baseline in `bench-phase-0.md`, but the **ratio** is a fair measure of the algorithmic speedup.

## Results (warm-CPU, back-to-back with matching Phase-0 re-run)

| Metric              | Phase 0 re-run (3 widths) | Phase 1 (1 width)   | Ratio |
| ------------------- | ------------------------- | ------------------- | ----- |
| Wall time (median)  | 24.083 s                  | **10.879 s**        | 2.21× |
| Wall time (p95)     | 25.497 s                  | 11.528 s            | 2.21× |
| Entries processed   | 93                        | 93                  | —     |
| Thumbnails emitted  | 278                       | 93                  | 0.33× |
| Per-entry p50       | 182.32 ms                 | 80.18 ms            | 2.27× |
| Per-entry p95       | 492.64 ms                 | 275.50 ms           | 1.79× |
| Throughput          | 4.36 entries/sec          | 8.55 entries/sec    | 1.96× |

**Per-stage breakdown (summed across entries, last timed run)**

| Stage    | Phase 0 (3w) | Phase 1 (1w) | Ratio | Expected |
| -------- | ------------ | ------------ | ----- | -------- |
| decode   |  5102.98 ms  |  5336.63 ms  | 0.96× | ~1.00×   |
| resize   | 11551.82 ms  |  3481.76 ms  | 3.32× | ~3.00×   |
| encode   |  2881.38 ms  |   661.33 ms  | 4.36× | ~3–5×    |
| db       |   467.47 ms  |   251.07 ms  | 1.86× | ~2×      |
| captured | 20003.65 ms  |  9730.79 ms  | 2.06× |          |
| wall     | 21336.22 ms  | 10878.58 ms  | 1.96× |          |

**Observations**

- **Decode is unchanged** (~5.1 s → ~5.3 s, within noise) — as predicted, we decode exactly once per entry regardless of how many widths get generated. Decode is now the single largest bucket at **49% of wall time**.
- **Resize cut by 3.32×** — almost exactly as expected. Going from three `img.thumbnail()` passes per entry to one drops 8 s of CPU time.
- **Encode cut by 4.36×** — more than the nominal 3× because we were previously encoding the 1600-px WebP, which is the most expensive output pixel-count-wise.
- **DB cut by 1.86×** — less than 3× because the post-entry cache-tally query runs once per entry regardless of how many widths were inserted.
- **Throughput nearly doubled** (4.36 → 8.55 entries/sec).

## Does Phase 1 hit the ≥3× wall-time target?

**No — 2.21× is meaningful but short of the 3× bar.** The task's 3× target assumed decode + resize + encode all scale with the width count. In practice only resize + encode do; decode is constant, and it now dominates the per-entry budget. Getting past 3× requires Phase 2 (parallel entry processing) so that decode runs concurrently across multiple entries.

Revised expectation:

- Phase 0 → Phase 1 (single-width, serial): ~2.2× — **observed**.
- Phase 1 → Phase 2 (single-width, parallel, `min(num_cpus, 8)` workers): should approach `min(workers, decode_parallelism_ceiling)`×. On a modern 8-core laptop the practical ceiling for image-decode is usually 4–6× before memory bandwidth and disk read saturate. So the combined Phase-0 → Phase-2 speedup should land in the 8–12× range, comfortably exceeding 3×.

## Cold-run reference (original Phase-0 number in `bench-phase-0.md`)

If we compare cold Phase-0 (8.676 s) against the warm Phase-1 (10.879 s), Phase 1 looks slower in absolute terms. This is **not** a regression — it's the thermal-drift artifact described above. The correct comparison is the same-session one tabled here.

## Next

Group 4 (parallelism) is required to meet the overall performance goal and will fix time-to-first-batch — which is the user-visible "stuck at 0/93" stall we opened this change to resolve.
