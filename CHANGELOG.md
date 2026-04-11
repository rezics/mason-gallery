# CHANGELOG

## [2.0.0] - 2026-04-08

### added
- introduce monorepo architecture (core, desktop, web, cli)
- add multi-platform support (desktop, web, cli)
- add folder sidebar and directory tree
- add position indicator and jump
- add incremental refresh and scan progress
- add i18n support

### changed
- migrate desktop to tauri v2 and react 19
- redesign UI with new layout and top menu bar
- introduce platform abstraction layer

### performance
- add axum-based local image server
- parallelize image scanning with rayon
- optimize virtual scrolling and layout prefill

### developer
- replace eslint + prettier with biome
- add github actions ci/cd

### breaking
- full rewrite, no migration from v1
