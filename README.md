# Mason Gallery

![banner](./public/logo/banner.svg)

Masonry layout Image Viewer — desktop, web, and CLI.

[正體中文](./doc/readme/zh-Hant.md)

## Monorepo Structure

```
packages/
├── core/       — Shared UI components, stores, types, i18n
├── desktop/    — Tauri desktop app (Windows, macOS, Linux)
├── web/        — Static web SPA (Chromium browsers)
└── cli/        — npm CLI that serves the web build locally
```

## Development

### Prerequisites

- [Bun](https://bun.sh/)
- [Rust](https://www.rust-lang.org/tools/install) (for desktop only)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) (for desktop only)

```bash
bun install
```

### Desktop

```bash
bun run dev:desktop
```

### Web

```bash
bun run dev:web
```

### CLI

```bash
bun run build:cli
```

### Linting & Type Checking

```bash
bun run check     # biome ci + tsc --build
bun run format    # biome format --write
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
git merge --squash dev

git commit -m "release: vX.X.X"

git push origin master
```
