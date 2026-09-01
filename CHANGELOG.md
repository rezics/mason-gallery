# CHANGELOG

## [2.2.0] - 2026-09-01

### added
- desktop multi-select: mark images, persist the selection, batch-move to a folder, or move to trash ([#14](https://github.com/rezics/mason-gallery/issues/14))
- open zip, rar, 7z, cbz, and cbr archives as galleries (desktop), including passwords and solid-archive warnings
- gallery library for folders and archives, with favorites, recent, rename, search, and type filters
- drop folders or archives into the app and choose whether to add them to the library
- lazy folder thumbnails and scan-time archive thumbnails; the grid uses thumbnails, the viewer uses originals
- settings sections for general, appearance, gallery, files, and cache
- light, dark, and system theme
- Simplified Chinese and Japanese, in addition to English and Traditional Chinese
- desktop update checks: manual check, automatic check toggle, and install-now or later
- collapsible app sidebar and folder-sidebar default
- web marketing site with locale routes (en, zh-hans, zh-hant, ja)

### changed
- redesign the management shell and settings around a shared library home
- split durable library data from disposable thumbnail and extract caches
- web app ships as an Astro site with automatic locale routing

### performance
- parallel thumbnail generation during archive scans
- on-demand folder thumbnails for the masonry grid
- viewport-aware column breakpoints

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
