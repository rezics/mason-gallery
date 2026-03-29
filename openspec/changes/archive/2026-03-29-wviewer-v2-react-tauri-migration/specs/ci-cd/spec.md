## ADDED Requirements

### Requirement: PR check workflow
The repository SHALL include a GitHub Actions workflow that runs on every pull request to `dev` and `master` branches. It SHALL check: Biome lint + format, TypeScript type checking, Rust fmt, and Rust clippy.

#### Scenario: PR with lint errors
- **WHEN** a PR contains code that fails Biome lint checks
- **THEN** the CI workflow SHALL fail and report the lint errors

#### Scenario: PR with Rust warnings
- **WHEN** a PR contains Rust code that triggers clippy warnings
- **THEN** the CI workflow SHALL fail (clippy runs with `-D warnings`)

### Requirement: Release workflow
The repository SHALL include a GitHub Actions workflow triggered on `v*` tag pushes that builds the application for Windows (x64), macOS (x64 + ARM64), and Linux (x64), and creates a draft GitHub Release with all platform artifacts.

#### Scenario: Tag push triggers release
- **WHEN** a tag `v2.0.0` is pushed
- **THEN** the release workflow SHALL build for all platforms and create a draft GitHub Release with NSIS installer (Windows), DMG (macOS x64 and ARM64), and AppImage + deb (Linux)

### Requirement: Auto-updater artifact generation
The release workflow SHALL generate and upload a `latest.json` file alongside platform artifacts for the tauri-plugin-updater.

#### Scenario: Updater JSON published
- **WHEN** a release is published
- **THEN** `latest.json` SHALL be available at `https://github.com/<owner>/<repo>/releases/latest/download/latest.json`

### Requirement: Bun setup in CI
All CI workflows SHALL use `oven-sh/setup-bun@v2` for Bun installation and `bun install --frozen-lockfile` for reproducible dependency installation.

#### Scenario: Frozen lockfile enforcement
- **WHEN** `bun.lockb` is out of date relative to `package.json`
- **THEN** `bun install --frozen-lockfile` SHALL fail and the CI workflow SHALL fail

### Requirement: Rust build caching
All CI workflows SHALL use `Swatinem/rust-cache@v2` with workspace configured to `./src-tauri -> target` for Rust compilation caching.

#### Scenario: Cached build
- **WHEN** a CI run has no Rust dependency changes from the previous run
- **THEN** the Rust build step SHALL use cached artifacts and complete significantly faster

### Requirement: Renovate configuration
The repository SHALL include a `renovate.json` configuration file for automated dependency updates with auto-merge for patch updates and grouped PRs for monorepo dependencies.

#### Scenario: Patch update auto-merged
- **WHEN** a patch update is available for a dependency and CI passes
- **THEN** Renovate SHALL automatically merge the update PR

### Requirement: Auto-update support
The application SHALL include `tauri-plugin-updater` configured with a public key and GitHub Releases endpoint. The application SHALL check for updates on launch.

#### Scenario: Update available
- **WHEN** the application launches and a newer version is published on GitHub Releases
- **THEN** the application SHALL notify the user that an update is available and offer to download and install it
