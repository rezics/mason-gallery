## 1. Expose Positioner from WaterfallGrid

- [x] 1.1 Add `onPositionerReady(positioner, columnCount)` callback prop to WaterfallGrid and call it in a `useEffect` when positioner or columnCount changes
- [x] 1.2 Update HomePage to receive positioner via the callback and store it in a ref

## 2. Grid Position Indicator

- [x] 2.1 Add `showGridPosition: boolean` setting to settingsStore (default `true`, persisted)
- [x] 2.2 Implement approximate current-index calculation: `scrollTop / (shortestColumn / itemCount) * columnCount`, clamped to valid range
- [x] 2.3 Extend the stats bar in HomePage to display `~{current} / {total}` when `showGridPosition` is enabled, updating on scroll

## 3. Jump to Index

- [x] 3.1 Wire up `useScrollToIndex(positioner, { element: scrollContainerRef, height, align: "center" })` in HomePage
- [x] 3.2 Build inline jump input UI: clicking the position indicator or pressing Ctrl+G opens a number input; Enter confirms (calls `scrollToIndex(n - 1)`), Escape cancels; input clamps to `[1, images.length]`
- [x] 3.3 Add i18n keys for jump UI labels (en/zh)

## 4. Lightbox Counter

- [x] 4.1 Add `yet-another-react-lightbox/plugins/counter` import and Counter plugin to the Lightbox plugins array in ImageViewer.tsx
- [x] 4.2 Import the counter CSS (`yet-another-react-lightbox/plugins/counter.css`) and verify styling

## 5. Settings UI

- [x] 5.1 Add toggle for "Show grid position" in the settings panel with i18n support
