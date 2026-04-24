# Phase 0 — Baseline (unchanged code, serial, 3 widths)

**Configuration**

- Archive: `C:\Users\edge\Pictures\测试图集-压缩\测试图集-压缩.zip` (93 image entries)
- Widths: `400,800,1600` (the existing hardcoded default)
- Workers: `0` (serial)
- Warmup: `1`, Runs: `3`
- Command:
  ```
  MASON_BENCH_WIDTHS=400,800,1600 MASON_BENCH_WORKERS=0 \
    cargo test --release --package mason-gallery --test bench_archive_scan \
    -- --ignored --nocapture
  ```

**Results**

| Metric             | Value          |
| ------------------ | -------------- |
| Wall time (median) | **8.676 s**    |
| Wall time (p95)    | 8.726 s        |
| Entries processed  | 93             |
| Thumbnails emitted | 278            |
| Per-entry p50      | 75.39 ms       |
| Per-entry p95      | 196.86 ms      |
| Throughput         | 10.72 entries/sec |

**Per-stage breakdown (summed across all entries, last timed run)**

| Stage    | Time       | % of wall |
| -------- | ---------- | --------- |
| decode   | 2202.21 ms | 25.4%     |
| resize   | 4207.60 ms | 48.5%     |
| encode   | 1385.55 ms | 16.0%     |
| db       |  283.64 ms |  3.3%     |
| **captured** | **8079.00 ms** | **93.1%** |
| wall     | 8675.96 ms | 100.0%    |

Instrumentation captures 93% of wall time — the remaining ~600 ms is archive-read I/O (reader.extract_entry_to_memory) plus small per-iteration overhead. Healthy signal-to-noise ratio for subsequent phases.

**Observations**

- **Resize dominates** (48.5% of wall) — the 3× width multiplier pays its cost here, since each width runs its own Lanczos-ish resample from the full decoded image.
- **Decode is the second-largest bucket** (25.4%) and runs exactly once per entry regardless of widths — collapsing to a single width does NOT reduce decode work.
- **Encode** (WebP writeout at 3 widths) costs 16%.
- **DB inserts** are negligible (3%).
- 278 thumbnails instead of 279 = 93 × 3: at least one image's native resolution matched one of the target widths (generation short-circuits when `target_w >= orig_w`), so its larger requested widths were skipped. Expected behavior, not a bug.

**Projection for Phase 1 (single width, serial)**

Dropping from 3 widths → 1 should eliminate roughly 2/3 of the resize cost and 2/3 of the encode cost, while leaving decode and DB essentially untouched. Conservative estimate:

- Expected wall: `decode (2.2) + resize/3 (1.4) + encode/3 (0.46) + db (0.28) + overhead (0.6)` ≈ **4.9 s**
- Expected speedup vs. Phase 0: ~1.77×

The task acceptance criterion is ≥3× — which would require dropping wall below ~2.9 s. That likely isn't reachable from the single-width change alone; the ≥3× target presumes Phase 1 + Phase 2 combined (single width + parallelism). We'll re-evaluate the Phase-1 acceptance bar when Phase 1 numbers land.
