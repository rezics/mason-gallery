# WViewer

Waterfall Image Viewer

## Development

### Prerequisites

- [Bun](https://bun.sh/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

```bash
bun install
bun run dev
```

### Updater Signing Key Setup

The auto-updater requires a signing key pair. Generate one with:

```bash
bunx @tauri-apps/cli signer generate -w ~/.tauri/wviewer.key
```

This creates:
- **Private key**: `~/.tauri/wviewer.key` (keep secret)
- **Public key**: printed to stdout

**Configure the project:**

1. Copy the public key into `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`
2. Add the following GitHub repository secrets for the release workflow:
   - `TAURI_SIGNING_PRIVATE_KEY` — contents of the private key file
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — password entered during generation (if any)
