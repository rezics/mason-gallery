# Mason Gallery

![banner](./public/logo/banner.svg)

Masonry layout Image Viewer — desktop, web, and CLI.

[繁体中文](./doc/readme/zh-Hant.md)

## Monorepo Structure

```
packages/
├── core/       — Shared UI components, stores, types, i18n
├── desktop/    — Tauri desktop app (Windows, macOS, Linux)
├── web/        — Astro static site + React browser app (Chromium browsers)
└── cli/        — npm CLI that serves the web build locally
```

## Development

### Prerequisites

- [Bun](https://bun.sh/)
- [Go Task](https://taskfile.dev/installation/)
- [Rust](https://www.rust-lang.org/tools/install) (for desktop only)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) (for desktop only)

```bash
bun install
```

### Desktop

```bash
task dev:desktop
```

### Web

```bash
task dev:web
```

### CLI

```bash
task build:cli
```

### Linting & Type Checking

```bash
task check     # biome ci + tsc --build
task format    # biome format --write
task test      # core + web behavior tests
```

### Updater Signing Key Setup (Desktop)

The auto-updater requires a signing key pair. Generate one with:

```bash
bunx @tauri-apps/cli signer generate -w ~/.tauri/mason-gallery.key
```

This creates:
- **Private key**: `~/.tauri/mason-gallery.key` (keep secret)
- **Public key**: printed to stdout

**Configure the project:**

1. Copy the public key into `packages/desktop/src-tauri/tauri.conf.json` under `plugins.updater.pubkey`
2. Add the following GitHub repository secrets for the release workflow:
   - `TAURI_SIGNING_PRIVATE_KEY` — contents of the private key file
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — password entered during generation (if any)

Keep the existing signing key when repairing updates. Installed clients trust the public
key bundled with their version; replacing the key would prevent them from installing updates.

The signing key was rotated after v2.2.0. Automatic updates from v2.2.0 are not being
repaired. Users of versions carrying the previous public key must manually install a
future release carrying the new public key before using automatic updates again.

The desktop release workflow verifies the signing key before building, checks each
platform's signed bundle, and downloads the completed `latest.json` and its installers
to verify all four supported targets. A successful build alone is insufficient. Releases
remain drafts until these checks pass and a maintainer publishes them.

To restore updater metadata for an existing published release without rebuilding its
installers or publishing a new version, dispatch **Release Desktop** with that release's
tag and `repair_only=true`, using the original signing credentials for that release.
For example, from a branch containing the repair workflow:

```bash
gh workflow run release.yml --ref YOUR_BRANCH -f tag=YOUR_RELEASE_TAG -f repair_only=true
```

Repair checks the original assets' SHA-256 digests, signs them using the repository
Secrets, verifies signatures against the public key from the original tag, and uploads
the signatures followed by `latest.json`. It preserves the binaries, tag, release notes,
and publication state. If a valid manifest already exists, repair only verifies it.

To verify the repository signing Secrets against the current branch's public key without
building binaries or modifying any release, dispatch with `verify_only=true`:

```bash
gh workflow run release.yml --ref YOUR_BRANCH -f tag=YOUR_RELEASE_TAG -f verify_only=true
```

## Publish

```bash
git checkout master

git pull origin master

# compress `dev` into a single commit merge.
git merge --squash dev --allow-unrelated-histories

git checkout --theirs .

git commit -m "release: vX.X.X"

git push origin master
```

```bash
git checkout master
git pull

git tag v2.2.0
git push origin v2.2.0
```
