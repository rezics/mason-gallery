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

git tag v2.1.0
git push origin v2.1.0
```
