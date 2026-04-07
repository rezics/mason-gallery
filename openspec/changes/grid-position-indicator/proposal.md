## Why

When browsing large image collections (1,000+ images), the masonry grid offers no sense of position or way to jump to a specific location. Users must scroll manually through potentially thousands of images with no indication of where they are in the collection. This makes it impractical to revisit a region of interest or navigate purposefully through a large folder.

## What Changes

- Add a position indicator to the existing stats bar showing approximate current position relative to total image count (e.g., `~420 / 1,280`)
- Add a "Go to" input that scrolls the masonry grid to a specific image index using Masonic's built-in `useScrollToIndex` hook
- Add an optional Counter plugin to the lightbox viewer showing `currentIndex / total`
- Add a setting to toggle the grid position indicator on/off (the stats bar itself remains; only the position/jump UI is togglable)
- Expose the positioner and scrollContainerRef from WaterfallGrid so the stats bar in HomePage can compute scroll position and trigger scroll-to-index

## Capabilities

### New Capabilities
- `grid-position-jump`: Position indicator and jump-to-index functionality for the masonry grid, plus optional lightbox counter

### Modified Capabilities
- `waterfall-view`: The WaterfallGrid component will expose its positioner for external consumption (scroll-to-index, scroll-position-to-index mapping)
- `settings-panel`: New toggle setting for grid position indicator visibility

## Impact

- **packages/core/src/components/WaterfallGrid.tsx** — Expose positioner via ref or callback; integrate `useScrollToIndex`
- **packages/core/src/pages/HomePage.tsx** — Extend stats bar with position indicator and jump input
- **packages/core/src/components/ImageViewer.tsx** — Add Counter plugin (optional)
- **packages/core/src/stores/settingsStore.ts** — New `showGridPosition` setting
- **packages/core/src/i18n/** — New translation keys for position UI
