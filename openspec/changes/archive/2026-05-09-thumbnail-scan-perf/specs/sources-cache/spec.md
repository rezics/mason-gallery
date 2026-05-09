## MODIFIED Requirements

### Requirement: Per-source policy override
Each row in the `sources` table SHALL have a nullable `policy_override` column storing a JSON blob with the same structure as `CachePolicy` (all fields optional). The `thumbnails` sub-object SHALL additionally accept an optional `widths: number[]` field which, when present, MUST be non-empty. When extracting or thumbnailing, the effective policy SHALL be computed by deep-merging `policy_override` onto the application-level `cachePolicy`; the `widths` array SHALL be replaced wholesale (not merged element-wise).

#### Scenario: Override narrows a single source
- **WHEN** the application policy has `extracted.mode="unlimited"` and a specific archive's `policy_override` is `{"extracted":{"mode":"no-cache"}}`
- **THEN** that archive SHALL be extracted on-demand without persistence while all other archives SHALL use unlimited caching

#### Scenario: No override uses application default
- **WHEN** a source has `policy_override=NULL`
- **THEN** the effective policy SHALL be the application-level `cachePolicy` unchanged

#### Scenario: Per-source width override replaces global widths
- **WHEN** global `thumbnailSizes=[800]` and a source has `policy_override={"thumbnails":{"widths":[400,800,1600]}}`
- **THEN** that source's effective thumbnail widths SHALL be `[400, 800, 1600]` and thumbnail generation SHALL produce three widths per entry
- **AND** other sources SHALL continue to use `[800]`

#### Scenario: Empty widths override rejected
- **WHEN** a client invokes `set_source_policy` with `policy_override.thumbnails.widths=[]`
- **THEN** the command SHALL return an error and SHALL NOT persist the override

## ADDED Requirements

### Requirement: Unified width resolution across scan paths
The Rust backend SHALL resolve the effective thumbnail widths for any source using a single function: `source.policy_override.thumbnails.widths ?? global_cache_policy.thumbnail_sizes`. This resolution SHALL be used identically by `scan_archive`, `scan_directory` (for inline-expanded archives), and `request_thumbnail`. No scan path SHALL reference hard-coded default widths at runtime; `default_widths()` may exist only as a bootstrap default for `cachePolicy.thumbnail_sizes` before the user has touched settings.

#### Scenario: Archive scan honors global default
- **WHEN** global `thumbnailSizes=[800]`, no per-source override, and `scan_archive` runs
- **THEN** each entry SHALL get thumbnails at width 800

#### Scenario: Folder scan honors global default
- **WHEN** global `thumbnailSizes=[800]`, no per-source override, and `scan_directory` expands an inline archive
- **THEN** the archive's entries SHALL get thumbnails at width 800 (not the previously hard-coded `[400, 800, 1600]`)

#### Scenario: Lazy request honors per-source override
- **WHEN** a lazy `request_thumbnail` fires for an entry of a source whose override is `{"thumbnails":{"widths":[400]}}`
- **THEN** the generated thumbnail SHALL be at width 400 regardless of the frontend-passed width hint

### Requirement: Global thumbnail sizes synced to Rust via cache policy
The `setCachePolicy` Tauri command SHALL accept `thumbnail_sizes: Vec<u32>` as part of the cache-policy payload and SHALL persist it to the Rust-side cache-policy state. Frontend changes to `thumbnailSizes` in settings SHALL trigger a `setCachePolicy` call so Rust always holds the authoritative current list.

#### Scenario: Settings change propagates to Rust
- **WHEN** the user changes `thumbnailSizes` from `[800]` to `[400, 800]` in the settings panel
- **THEN** the frontend SHALL invoke `setCachePolicy` with the updated list and Rust's cached policy SHALL reflect the new widths
