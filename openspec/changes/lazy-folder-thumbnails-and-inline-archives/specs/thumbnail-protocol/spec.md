## ADDED Requirements

### Requirement: Incremental thumbnail population
An `ImageEntry` emitted with empty or absent `thumbnails` MAY later be populated asynchronously via an `images:thumbnails` event. The frontend SHALL treat initial `thumbnails` omission as "no thumbs yet" (not "no thumbs ever") when `folderThumbnails: "lazy"` is active, and SHALL accept incremental updates that patch the entry's `thumbnails` array in place.

#### Scenario: Initial emission without thumbs
- **WHEN** `scan_directory` emits an entry for a folder image and `folderThumbnails: "lazy"` is active
- **THEN** the entry SHALL have `thumbnails` absent or empty
- **AND** the frontend SHALL render the original via `source` while awaiting a potential `images:thumbnails` event

#### Scenario: Patch replaces thumbs in place
- **WHEN** an `images:thumbnails` event arrives for an entry already in the store
- **THEN** the store SHALL replace the entry's `thumbnails` field with the event payload
- **AND** only the affected grid tile SHALL re-render (not the entire grid)

### Requirement: Frontend registry of outstanding requests
The frontend SHALL maintain an in-memory set of `(sourceId, entryPath)` keys representing thumbnails currently requested but not yet delivered. The registry SHALL be used to dedupe requests, coordinate cancellations on viewport exit, and prevent requesting thumbnails for entries that already have them or are known to be skipped.

#### Scenario: Entries with thumbs never re-requested
- **WHEN** an entry in the store has `thumbnails.length > 0`
- **THEN** the grid SHALL NOT call `requestThumbnail` for that entry even if it re-enters the viewport

#### Scenario: Skipped entries never re-requested
- **WHEN** a prior `requestThumbnail` returned `skipped: true` (e.g., file below `minFileSize`) for an entry
- **THEN** the frontend SHALL mark the entry as skipped and SHALL NOT re-request on subsequent viewport entries
