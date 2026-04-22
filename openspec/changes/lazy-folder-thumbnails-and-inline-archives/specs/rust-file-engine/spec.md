## ADDED Requirements

### Requirement: Thumbnail request and cancel commands
The Rust backend SHALL expose two Tauri commands — `request_thumbnail(sourceId: number, entryPath: string)` and `cancel_thumbnail(sourceId: number, entryPath: string)`. The former SHALL enqueue a thumbnail generation task (or no-op if already queued, already in flight, already cached, or skipped due to file-size threshold). The latter SHALL remove the task from the pending queue or set its cancel flag if in flight.

#### Scenario: Request enqueues task
- **WHEN** `request_thumbnail(7, "a.jpg")` is invoked and no prior entry exists in the queue
- **THEN** a new queue slot SHALL be created for that key and the worker SHALL be notified

#### Scenario: Request for cached entry returns without work
- **WHEN** `request_thumbnail(7, "a.jpg")` is invoked and all configured-width thumbnails already exist in the cache
- **THEN** the command SHALL return immediately without enqueueing or emitting any event

#### Scenario: Cancel removes pending
- **WHEN** `cancel_thumbnail(7, "a.jpg")` is invoked while the task is still in the pending queue
- **THEN** the task SHALL be removed and the worker SHALL never dequeue it

#### Scenario: Cancel aborts in-flight
- **WHEN** `cancel_thumbnail(7, "a.jpg")` is invoked while the worker is resizing the image
- **THEN** the next cooperative check SHALL abort the task before it emits an event

### Requirement: Background thumbnail worker
The Rust backend SHALL run a single tokio task at app startup that owns the thumbnail queue and processes requests in LIFO order with a `tokio::sync::Semaphore(4)` concurrency limit. Blocking image operations SHALL run on `tokio::task::spawn_blocking`. The worker SHALL live for the process lifetime.

#### Scenario: Worker starts at app launch
- **WHEN** the Tauri application starts
- **THEN** a background thumbnail worker task SHALL be spawned and register itself with the managed state

#### Scenario: Blocking work dispatched
- **WHEN** the worker picks a task and begins decoding
- **THEN** the decode/resize/encode steps SHALL run inside `spawn_blocking` (not on the async runtime thread)

### Requirement: `images:thumbnails` event emission
Completed thumbnail generations SHALL produce a `images:thumbnails` Tauri event with payload `{ sourceId: number, entryPath: string, thumbnails: Thumbnail[] }`. The event SHALL NOT fire for canceled tasks or for tasks that produced no output (e.g., skipped due to size threshold).

#### Scenario: Successful completion emits event
- **WHEN** the worker completes generation for `(7, "a.jpg")` at widths `[400, 800]`
- **THEN** an `images:thumbnails` event SHALL be emitted with a `thumbnails` array of length 2 containing `mg-thumb://` URIs

## MODIFIED Requirements

### Requirement: Recursive directory traversal
The Rust backend SHALL provide a Tauri command `scan_directory` that accepts one or more directory paths, supported image formats, a page size, and a sort method. It SHALL recursively traverse all directories and subdirectories. When an archive file (`.zip`, `.rar`, `.7z`, `.cbz`, `.cbr`) is encountered during traversal, the backend SHALL delegate to the archive service to enumerate its entries and emit them inline in the same `images:batch` stream — subject to the password state of the archive. For unencrypted archives (or archives with a known password), the archive's image entries SHALL be listed and emitted. For encrypted archives without a known password, a single `locked: true` placeholder entry SHALL be emitted in place of the archive's contents.

#### Scenario: Single directory scan
- **WHEN** `scan_directory` is invoked with a single directory path and image formats `[".jpg", ".png", ".webp"]`
- **THEN** the backend SHALL recursively find all files matching those extensions in the directory and its subdirectories

#### Scenario: Multiple directory scan
- **WHEN** `scan_directory` is invoked with an array of directory paths
- **THEN** the backend SHALL traverse all provided directories and their subdirectories

#### Scenario: Archive in folder expanded inline
- **WHEN** the traversal encounters `D:/photos/pack.zip` (unencrypted)
- **THEN** the backend SHALL upsert a `sources` row for `pack.zip` and emit its image entries in the same batch stream as the folder's loose images

#### Scenario: Locked archive produces placeholder
- **WHEN** the traversal encounters an encrypted archive and no password is known
- **THEN** a single placeholder entry with `locked: true` SHALL be emitted in place of the archive's contents
