## ADDED Requirements

### Requirement: `mg-thumb://` URI scheme
The application SHALL use a URI scheme `mg-thumb:///<source-hash>/<entry-hash>?w=<width>` to identify thumbnail resources. `source-hash` SHALL be the `content_hash` of the owning source (from the `sources` table); `entry-hash` SHALL be the deterministic hash of the entry path; `w` SHALL be the thumbnail width in pixels. The URI SHALL be treated as an opaque identifier by frontend components.

#### Scenario: Well-formed URI
- **WHEN** a thumbnail is emitted for source hash `a7f3c4d2...`, entry hash `b2e891f...`, width 400
- **THEN** the URI SHALL be `mg-thumb:///a7f3c4d2.../b2e891f...?w=400`

#### Scenario: Frontend does not parse URI
- **WHEN** a `mg-thumb://` URI appears in an `ImageEntry.thumbnails[i].source` field
- **THEN** frontend components SHALL pass it to `platform.getThumbUrl()` without inspecting its internal structure

### Requirement: `getThumbUrl` on PlatformService
The `PlatformService` interface SHALL declare `getThumbUrl(thumbId: string): string`, which converts an opaque thumbnail identifier into a loadable HTTP URL. The desktop implementation SHALL parse the `mg-thumb://` URI and return `http://127.0.0.1:<port>/thumb?source=<source-hash>&entry=<entry-hash>&w=<width>`. The web implementation SHALL return an empty string (web has no thumbnails).

#### Scenario: Desktop thumb URL resolution
- **WHEN** `TauriPlatformService.getThumbUrl("mg-thumb:///a7f3c/b2e89?w=400")` is called and the server is listening on port 51234
- **THEN** the return value SHALL be `http://127.0.0.1:51234/thumb?source=a7f3c&entry=b2e89&w=400`

#### Scenario: Web stub returns empty
- **WHEN** `WebPlatformService.getThumbUrl(...)` is called with any argument
- **THEN** the return value SHALL be an empty string

### Requirement: ImageEntry carries multi-resolution thumbnails
Each `ImageEntry` emitted by the Rust backend SHALL include an optional `thumbnails: Thumbnail[]` field. Each `Thumbnail` SHALL have `source` (the `mg-thumb://` URI), `width` (pixels, used for the `Nw` srcset descriptor), and `height` (pixels). When `thumbnails` is absent, `undefined`, or an empty array, the frontend SHALL render the original via `source` alone without `srcSet`.

#### Scenario: Archive entry includes thumbnails
- **WHEN** `scan_archive` emits an image entry and thumbnails are configured at widths `[400, 800, 1600]`
- **THEN** the entry SHALL include a `thumbnails` array with three elements at those widths, each carrying a `mg-thumb://` URI

#### Scenario: Folder entry without thumbnails
- **WHEN** `scan_directory` emits an image entry and folder thumbnails are not enabled
- **THEN** the entry SHALL have `thumbnails` absent or empty

### Requirement: Single-path `<img>` rendering with dynamic attribute injection
The waterfall grid SHALL render each image with one `<img>` element whose attributes are injected dynamically from the `ImageEntry`. `src` SHALL be `platform.getImageUrl(entry.source)`. `srcSet` SHALL be generated from `entry.thumbnails` (joined as `"<url> <width>w"` comma-separated) when the array is non-empty, otherwise omitted. `width` and `height` SHALL be forwarded from `entry.width` / `entry.height` when available. There SHALL NOT be separate render branches for "has thumbnails" vs "no thumbnails".

#### Scenario: Thumbnails present drive srcset selection
- **WHEN** an entry has `thumbnails=[{width:400,...}, {width:800,...}]` and `source="archive:///pack.zip#a.jpg"`
- **THEN** the rendered `<img>` SHALL have `srcSet="<thumb400-url> 400w, <thumb800-url> 800w"` and `src="<original-url>"` (original used only as browser fallback; never loaded when a srcset candidate matches)

#### Scenario: No thumbnails falls back to original
- **WHEN** an entry has `thumbnails=undefined` and `source="file:///D:/a.jpg"`
- **THEN** the rendered `<img>` SHALL have `src="<original-url>"`, no `srcSet`, and `width`/`height` from the entry (if known)

#### Scenario: Width and height propagated independently of thumbnails
- **WHEN** an entry has `width=1920`, `height=1080`, and `thumbnails=undefined`
- **THEN** the rendered `<img>` SHALL include `width="1920"` and `height="1080"` attributes regardless of the thumbnail branch
