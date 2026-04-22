## ADDED Requirements

### Requirement: Password prompt dialog
When a password-protected archive is opened without a stored or cached password, the application SHALL display a password input dialog.

#### Scenario: First open of encrypted archive
- **WHEN** a password-protected archive is opened and no password is available
- **THEN** a dialog SHALL appear with a password input field, a "Remember password" checkbox, and Submit/Cancel buttons

#### Scenario: Wrong password retry
- **WHEN** the user enters an incorrect password
- **THEN** the dialog SHALL display an error message and allow retry

#### Scenario: Cancel password dialog
- **WHEN** the user cancels the password dialog
- **THEN** the archive SHALL not be opened

### Requirement: In-memory password cache
Passwords entered during the current session SHALL be cached in memory, keyed by archive path. The in-memory cache SHALL be cleared when the application exits.

#### Scenario: Password cached for session
- **WHEN** the user enters a password for `pack.zip` and later re-opens it in the same session
- **THEN** the stored in-memory password SHALL be used without prompting

#### Scenario: Password cleared on exit
- **WHEN** the application exits
- **THEN** all in-memory password caches SHALL be discarded

### Requirement: Plaintext password persistence
When the user opts to remember a password and plaintext storage mode is active, the password SHALL be stored unencrypted in the SQLite passwords table.

#### Scenario: Save password in plaintext mode
- **WHEN** the user checks "Remember password" and the storage mode is "plaintext"
- **THEN** the password SHALL be saved to the `passwords` table with `encrypted = false`

#### Scenario: Load plaintext password on next open
- **WHEN** a previously saved plaintext password exists for an archive
- **THEN** the archive SHALL be opened without prompting for a password

### Requirement: Master password encrypted persistence
When master password mode is active, saved archive passwords SHALL be encrypted with AES-256-GCM using a key derived from the master password via PBKDF2 (100,000 iterations, random salt).

#### Scenario: Set master password
- **WHEN** the user enables master password mode for the first time
- **THEN** a dialog SHALL prompt the user to create a master password

#### Scenario: Save password with master password
- **WHEN** the user checks "Remember password" and master password mode is active
- **THEN** the archive password SHALL be encrypted and saved with `encrypted = true`, along with the salt and IV

#### Scenario: Unlock on app start
- **WHEN** the application starts and master password mode is active with saved passwords
- **THEN** the user SHALL be prompted for the master password when an encrypted archive password is first needed (lazy unlock, not at startup)

#### Scenario: Wrong master password
- **WHEN** the user enters an incorrect master password during unlock
- **THEN** decryption SHALL fail and the user SHALL be prompted to retry or enter the archive password directly

### Requirement: Password storage mode configuration
The user SHALL be able to select the password storage mode in settings: "Don't save" (default), "Plaintext", or "Master password".

#### Scenario: Switch from plaintext to master password mode
- **WHEN** the user switches to master password mode with existing plaintext passwords
- **THEN** the application SHALL prompt to set a master password and re-encrypt all stored passwords

#### Scenario: Switch to "Don't save"
- **WHEN** the user switches to "Don't save" mode
- **THEN** all persisted passwords SHALL be deleted from the database

### Requirement: Delete saved password
The user SHALL be able to delete individual saved passwords from the cache management page or settings.

#### Scenario: Delete one password
- **WHEN** the user deletes the saved password for `pack.zip`
- **THEN** the password record SHALL be removed from SQLite and the next open SHALL prompt for the password
