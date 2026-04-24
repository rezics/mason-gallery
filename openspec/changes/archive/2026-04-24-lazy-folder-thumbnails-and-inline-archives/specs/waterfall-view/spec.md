## ADDED Requirements

### Requirement: Viewport observer per grid tile
Each grid tile SHALL attach an `IntersectionObserver` on mount that tracks whether the tile is within the viewport. On transition to intersecting, a 150ms dwell timeout SHALL be scheduled. On transition to non-intersecting (either before or after the dwell elapses), the dwell timeout SHALL be cleared and — if a thumbnail request has already been issued but not yet resolved — `platform.cancelThumbnail(...)` SHALL be invoked.

#### Scenario: Observer attached at mount
- **WHEN** a grid tile component mounts for an entry that has no thumbnails and is eligible (folder images when `folderThumbnails: "lazy"`)
- **THEN** an `IntersectionObserver` SHALL be created for the tile's DOM element

#### Scenario: Observer detached at unmount
- **WHEN** a grid tile unmounts (e.g., virtualized out)
- **THEN** its `IntersectionObserver` SHALL be disconnected and any pending dwell timeout cleared

#### Scenario: Dwell cancel on exit before 150ms
- **WHEN** a tile enters the viewport and exits at 80ms
- **THEN** the dwell timeout SHALL be cleared without calling `requestThumbnail`

#### Scenario: Cancel after request issued
- **WHEN** a tile's thumbnail was requested (after dwell) but the tile exits the viewport before thumbnails arrive
- **THEN** `platform.cancelThumbnail(sourceId, entryPath)` SHALL be invoked

### Requirement: Locked archive tile
Grid tiles for entries with `locked: true` SHALL render a distinct visual treatment (e.g., a lock icon overlay on a muted background) instead of an image. Clicking a locked tile SHALL open the password dialog for that archive. After successful unlock, the tile SHALL be replaced in-place by the archive's first available entries as `scan_archive` emits them.

#### Scenario: Locked tile renders icon
- **WHEN** an entry with `locked: true` is rendered in the grid
- **THEN** the tile SHALL display a lock icon and the archive's relative path, and SHALL NOT render an `<img>` element

#### Scenario: Click opens password dialog
- **WHEN** the user clicks a locked tile
- **THEN** the password dialog SHALL open, pre-filled with the archive's path

#### Scenario: Unlock replaces placeholder
- **WHEN** the user enters a correct password and `scan_archive` begins emitting entries
- **THEN** the store SHALL remove the placeholder entry and insert the archive's actual entries at the same position

### Requirement: Grid re-render scoped to updated tile
When an `images:thumbnails` event patches an entry in the store, only the grid tile rendering that entry SHALL re-render. The overall grid layout SHALL NOT recompute positions (aspect ratio was established from the original's width/height).

#### Scenario: Patch triggers local re-render only
- **WHEN** the store patches `thumbnails` on a single entry
- **THEN** the tile for that entry SHALL re-render with `srcSet` populated
- **AND** adjacent tiles SHALL NOT re-render
- **AND** the masonic positioner SHALL NOT recompute column layout
