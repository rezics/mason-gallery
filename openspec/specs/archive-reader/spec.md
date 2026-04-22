## ADDED Requirements

### Requirement: Archive format support
The archive reader SHALL support reading ZIP, RAR, and 7z archive formats. It SHALL detect the format from the file header (magic bytes), not file extension alone.

#### Scenario: Open a ZIP archive
- **WHEN** a `.zip` file is opened
- **THEN** the reader SHALL parse the central directory and list all entries

#### Scenario: Open a RAR archive
- **WHEN** a `.rar` file is opened
- **THEN** the reader SHALL parse the archive headers and list all entries

#### Scenario: Open a 7z archive
- **WHEN** a `.7z` file is opened
- **THEN** the reader SHALL parse the file index and list all entries

#### Scenario: Unsupported format
- **WHEN** a file with an unrecognized format is opened as an archive
- **THEN** the reader SHALL return an error indicating the format is unsupported

### Requirement: Archive file listing
The archive reader SHALL list all image entries in an archive, returning each entry's path, compressed size, and uncompressed size. Only entries whose extension matches the user's configured image formats SHALL be included.

#### Scenario: List image entries
- **WHEN** an archive containing `photo.jpg`, `readme.txt`, and `art.png` is listed with formats `[jpg, png]`
- **THEN** the result SHALL include `photo.jpg` and `art.png` but not `readme.txt`

#### Scenario: Nested directory structure
- **WHEN** an archive contains entries at `folder/subfolder/image.jpg`
- **THEN** the listing SHALL preserve the full relative path

### Requirement: Single entry extraction
The archive reader SHALL support extracting a single entry by its path within the archive, writing the result to a specified output path or returning it as a byte buffer.

#### Scenario: Extract one image from ZIP
- **WHEN** entry `photos/cat.jpg` is requested from a ZIP archive
- **THEN** the reader SHALL extract only that entry without decompressing other files

#### Scenario: Extract one image from non-solid RAR
- **WHEN** entry `photos/cat.jpg` is requested from a non-solid RAR archive
- **THEN** the reader SHALL extract only that entry

#### Scenario: Extract from solid archive
- **WHEN** entry `photos/cat.jpg` is requested from a solid RAR or 7z archive
- **THEN** the reader SHALL extract the containing solid block (all entries in that block) to fulfill the request

### Requirement: Solid archive detection
The archive reader SHALL detect whether an archive uses solid compression and report this as part of the archive metadata.

#### Scenario: Solid RAR detected
- **WHEN** a RAR archive with the solid flag set in its header is opened
- **THEN** the archive info SHALL indicate `is_solid: true`

#### Scenario: Solid 7z detected
- **WHEN** a 7z archive where multiple files share a single coder block is opened
- **THEN** the archive info SHALL indicate `is_solid: true`

#### Scenario: ZIP is never solid
- **WHEN** a ZIP archive is opened
- **THEN** the archive info SHALL always indicate `is_solid: false`

### Requirement: Password-protected archive support
The archive reader SHALL accept an optional password parameter for all operations. If the archive is encrypted and no password or an incorrect password is provided, the reader SHALL return a specific error type distinguishable from other errors.

#### Scenario: Correct password provided
- **WHEN** a password-protected ZIP is opened with the correct password
- **THEN** the reader SHALL successfully list and extract entries

#### Scenario: Wrong password provided
- **WHEN** a password-protected archive is opened with an incorrect password
- **THEN** the reader SHALL return a `WrongPassword` error

#### Scenario: No password for encrypted archive
- **WHEN** a password-protected archive is opened without a password
- **THEN** the reader SHALL return a `PasswordRequired` error

### Requirement: Archive metadata
The archive reader SHALL return metadata about an archive: total entry count, total uncompressed size, whether it is solid, whether it is encrypted, and the detected format.

#### Scenario: Get archive info
- **WHEN** `get_archive_info` is called on a 30GB encrypted solid RAR with 5,000 image entries
- **THEN** the result SHALL include `{ format: "rar", entry_count: 5000, total_size: 30GB, is_solid: true, is_encrypted: true }`
