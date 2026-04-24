## ADDED Requirements

### Requirement: Archive files encountered during folder scan are inline-expanded
During a `scan_directory` traversal, when a file whose extension matches an archive format (`.zip`, `.rar`, `.7z`, `.cbz`, `.cbr`) is encountered, the backend SHALL NOT emit it as an image entry. Instead, the backend SHALL (a) upsert a `sources` row with `kind='archive'` for the archive, (b) list the archive's image entries via the archive service, (c) generate or retrieve cached thumbnails for each entry, and (d) emit those entries as part of the same `images:batch` stream as the folder's loose images.

#### Scenario: Unencrypted archive in mixed folder
- **WHEN** `scan_directory` encounters `D:/photos/pack.zip` (unencrypted, containing 50 images) during a scan of `D:/photos/`
- **THEN** a `sources` row SHALL be created for `pack.zip` with `kind='archive'`
- **AND** 50 image entries from the archive SHALL be emitted in the folder's `images:batch` output, each with `source="archive:///D:/photos/pack.zip#..."`

#### Scenario: Folder count includes archive entries
- **WHEN** a mixed folder contains 100 loose images and two archives with 30 and 20 entries respectively
- **THEN** the `images:count` event SHALL report a total of 150

### Requirement: Password-protected archives produce placeholder entries
When `scan_directory` encounters an archive that is password-protected and no password is known (neither in-memory nor persisted), the backend SHALL emit a single placeholder entry representing the archive. The entry SHALL have `source` set to the archive's `archive:///` URI (no fragment), `relativePath` set to the archive's relative path, `width=null`, `height=null`, `thumbnails` absent, and a `locked: true` flag. The archive's contents SHALL NOT be listed or emitted until it is unlocked.

#### Scenario: Locked archive emits placeholder
- **WHEN** `scan_directory` encounters an encrypted `secret.rar` and no password is known
- **THEN** a single placeholder entry SHALL be emitted with `locked=true`, `source="archive:///D:/photos/secret.rar"`, and no image thumbnails

#### Scenario: Known password expands inline
- **WHEN** `scan_directory` encounters an encrypted `secret.rar` whose password is already stored (in-memory or persisted plaintext)
- **THEN** the archive SHALL be listed and its entries emitted inline, identically to an unencrypted archive

### Requirement: Unlock replaces placeholder with entries
When a user unlocks a placeholder archive via the password dialog, the backend SHALL invoke `scan_archive` for just that archive. The resulting entries SHALL be merged into the existing image store, replacing the placeholder in-place (by matching `source` prefix).

#### Scenario: Unlock flow
- **WHEN** the user clicks a locked archive placeholder and enters the correct password
- **THEN** `unlock_archive` SHALL store the password and `scan_archive` SHALL emit the archive's entries
- **AND** the store SHALL replace the placeholder at the same position with the first entries as they stream in

#### Scenario: Wrong password retains placeholder
- **WHEN** the user enters a wrong password in the unlock dialog
- **THEN** the placeholder SHALL remain in the grid and the dialog SHALL show a retry state

### Requirement: Migration detection applies to inline-discovered archives
Inline-discovered archives SHALL pass through the same migration-candidate detection as explicitly opened archives. If an inline archive's path has no exact `sources` row but matches a candidate by identity segment and size, the backend SHALL emit a migration prompt (reusing the existing mechanism).

#### Scenario: Inline archive migration candidate
- **WHEN** `scan_directory` encounters `E:/photos/pack.zip` that matches an existing `sources` row at `D:/old/pack.zip` by `(identity_segment, size_hint)`
- **THEN** the backend SHALL emit the same migration-candidate signal as if the user had opened `E:/photos/pack.zip` directly

### Requirement: Scan order preserves folder structure
The emitted entries from a mixed-folder scan SHALL be ordered according to the configured sort method, with archive entries appearing at the position of their containing archive file in the parent folder's listing. Archive entries SHALL be sorted among themselves by the same sort method within their archive.

#### Scenario: Natural name sort with archive in middle
- **WHEN** a folder sorted `name-asc` contains `a.jpg`, `b.jpg`, `m.zip` (containing `x.jpg`, `y.jpg`), `z.jpg`
- **THEN** the emission order SHALL be: `a.jpg`, `b.jpg`, `m.zip#x.jpg`, `m.zip#y.jpg`, `z.jpg`
