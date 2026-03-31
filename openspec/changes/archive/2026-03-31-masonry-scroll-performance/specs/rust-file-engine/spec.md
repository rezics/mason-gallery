## MODIFIED Requirements

### Requirement: Streaming batch emission
The backend SHALL emit image data to the frontend in two phases via Tauri events. First, an `images:count` event SHALL be emitted after directory traversal and sorting complete, containing the total number of matched files. Then, `images:batch` events SHALL be emitted as dimension extraction proceeds, each containing up to `page_size` images. This ensures the frontend knows the total count before any image metadata arrives.

#### Scenario: Two-phase emission
- **WHEN** a directory with 500 images is scanned with `page_size: 50`
- **THEN** the backend SHALL first emit one `images:count` event with `{ total: 500 }`
- **AND** then emit approximately 10 `images:batch` events, each containing up to 50 images

#### Scenario: Scan completion signal
- **WHEN** directory traversal is complete
- **THEN** a final `images:batch` event SHALL be emitted with `done: true`
