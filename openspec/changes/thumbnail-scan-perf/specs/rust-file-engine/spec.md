## MODIFIED Requirements

### Requirement: Scan archive command
The Rust backend SHALL provide a Tauri command `scan_archive` that accepts an archive file path, image formats, page size, sort method, and an optional password. It SHALL read the archive's file index, filter for image entries, generate/retrieve cached thumbnails at the source's effective widths (resolved via `sources-cache` → unified width resolution), and emit results as `images:batch` events — identical in shape to `scan_directory` output. Entry processing SHALL run on a bounded parallel worker pool; batch emission SHALL preserve original sort order.

#### Scenario: Scan a ZIP archive
- **WHEN** `scan_archive` is invoked with a ZIP file path and formats `[jpg, png, webp]`
- **THEN** the backend SHALL list all matching image entries, generate thumbnails for uncached entries at the resolved effective widths, and emit `images:count` followed by `images:batch` events

#### Scenario: Scan with cached thumbnails
- **WHEN** `scan_archive` is invoked for a previously scanned archive with a valid cache
- **THEN** the backend SHALL emit batches using cached thumbnail data without re-extracting from the archive

#### Scenario: Password required
- **WHEN** `scan_archive` is invoked on an encrypted archive without a password
- **THEN** the backend SHALL return a `PasswordRequired` error

#### Scenario: Batches emitted in source sort order
- **WHEN** `scan_archive` processes entries in parallel and entry index 5 completes before entry index 2
- **THEN** `images:batch` events SHALL NOT be emitted with entry 5 before entry 2
- **AND** the reassembly buffer SHALL hold completed-but-out-of-order entries until their predecessors finish

## ADDED Requirements

### Requirement: Parallel entry processing in archive scans
`scan_archive` SHALL process entries on a bounded pool of `tokio::task::spawn_blocking` workers. The worker count SHALL default to `min(num_cpus::get(), 8)` and SHALL be overridable via the benchmark environment variable `MASON_BENCH_WORKERS` (0 = fully serial, for baseline measurement). Decode, resize, and encode operations SHALL run inside `spawn_blocking` — never on the async runtime thread.

#### Scenario: Parallel workers engaged
- **WHEN** `scan_archive` runs on a machine with 8 logical cores and no explicit `MASON_BENCH_WORKERS` override
- **THEN** up to 8 entries SHALL be decoded / resized / encoded concurrently

#### Scenario: Serial baseline via env override
- **WHEN** `MASON_BENCH_WORKERS=0` is set and the benchmark runs `scan_archive`
- **THEN** entries SHALL be processed one at a time (serial) for comparable baseline measurement

### Requirement: Ordered reassembly buffer
The backend SHALL maintain a small in-memory buffer keyed by each entry's original sort index. A cursor SHALL track the next-expected index; completed entries SHALL accumulate into the buffer and be drained to the batch buffer only when their index equals the cursor (advancing contiguous runs). When the batch buffer reaches `page_size` or the scan completes, a single `images:batch` event SHALL fire.

#### Scenario: Out-of-order completion held
- **WHEN** entries 0, 1, 2, 3 are dispatched to workers and entry 3 completes first
- **THEN** entry 3 SHALL be held in the reassembly buffer and SHALL NOT be emitted until entries 0, 1, 2 have completed
- **AND** once entry 0 completes, the cursor SHALL drain contiguously to the highest completed index

#### Scenario: Final flush on completion
- **WHEN** the last entry completes and the batch buffer is non-empty
- **THEN** one final `images:batch` event SHALL fire with `done: true`

### Requirement: Folder scan width resolution
`scan_directory` SHALL NOT reference a hard-coded `default_widths()` array when expanding inline archives or preparing lazy-thumbnail entries. Widths SHALL be resolved per the unified width-resolution rule: `source.policy_override.thumbnails.widths ?? global_cache_policy.thumbnail_sizes`.

#### Scenario: Folder scan with global default
- **WHEN** a folder scan encounters an inline archive and global `thumbnailSizes=[800]` with no per-source override
- **THEN** the archive's entries SHALL receive thumbnails at width 800 (not `[400, 800, 1600]`)

#### Scenario: Folder scan with per-source archive override
- **WHEN** a folder scan encounters an inline archive whose `policy_override.thumbnails.widths=[400]`
- **THEN** that archive's entries SHALL receive thumbnails at width 400 only
