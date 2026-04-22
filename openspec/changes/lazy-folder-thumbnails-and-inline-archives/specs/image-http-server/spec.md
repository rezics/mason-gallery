## MODIFIED Requirements

### Requirement: Thumbnail endpoint
The server SHALL expose a `GET /thumb?source=<source-hash>&entry=<entry-hash>&w=<width>` endpoint that serves cached thumbnail images. The handler SHALL look up the thumbnail file at `<cache-dir>/thumbs/<source-hash>/<entry-hash>_<width>.webp` and stream its bytes. The endpoint SHALL NEVER trigger thumbnail generation — thumbnails are produced by the scan pipeline (for archives) or by the async lazy worker (for folders). When a requested thumbnail does not exist, the server SHALL respond with HTTP 404; the frontend SHALL treat 404 as a transient "not ready yet" state and fall back to the original via `src`, without treating it as an error.

#### Scenario: Valid thumbnail request
- **WHEN** a GET request is made to `/thumb?source=a7f3c&entry=b2e89&w=400` and the file exists
- **THEN** the server SHALL respond with HTTP 200, the WebP bytes, and `Content-Type: image/webp`

#### Scenario: Missing query parameter
- **WHEN** a GET request to `/thumb` lacks `source`, `entry`, or `w`
- **THEN** the server SHALL respond with HTTP 400

#### Scenario: Thumbnail not found — transient state
- **WHEN** a GET request is made for a thumbnail whose file has not yet been generated (lazy pipeline still pending or recently requested)
- **THEN** the server SHALL respond with HTTP 404
- **AND** the frontend SHALL NOT treat this as an error — the tile continues showing the original until an `images:thumbnails` event delivers the ready thumbnails
