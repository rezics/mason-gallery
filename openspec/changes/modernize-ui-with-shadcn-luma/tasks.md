## 1. Foundation

- [x] 1.1 Add shadcn/Base UI, icon, and utility dependencies needed by the shared core UI layer.
- [x] 1.2 Create the shared `components/ui` structure in `packages/core` for generated and wrapped shadcn/Base UI primitives.
- [x] 1.3 Define the complete light and dark shadcn theme tokens in shared CSS, preserving `#f4606c` as the primary brand accent.
- [x] 1.4 Add theme preference state, persistence, hydration, and system preference handling.
- [x] 1.5 Remove MUI ThemeProvider/CssBaseline usage from the shared shell and replace it with Tailwind/shadcn theme application.

## 2. Shell Chrome

- [x] 2.1 Replace shared menu bar components with Tailwind/shadcn/Base UI controls.
- [x] 2.2 Replace desktop titlebar controls and window buttons without changing Tauri drag-region behavior.
- [x] 2.3 Replace app-level tooltips, dropdown menus, buttons, dividers, and icons used by shell chrome.
- [ ] 2.4 Verify desktop and web shell layout in both light and dark themes.

## 3. Dialogs Notifications And Viewer Controls

- [x] 3.1 Replace password, migration confirmation, archive warning, and cache confirmation dialogs with the new dialog primitives.
- [x] 3.2 Replace update checker notification UI with the new notification or toast surface.
- [x] 3.3 Replace image viewer toolbar buttons, info/delete dialogs, and transient messages without changing viewer navigation behavior.
- [ ] 3.4 Verify keyboard focus, escape handling, and accessible labels for all replaced overlay controls.

## 4. Quick Gallery Panel

- [x] 4.1 Rename and reshape the current settings overlay into a quick gallery panel state and component.
- [x] 4.2 Add frequent controls for sort method, grid position visibility, page size or load density, and waterfall column behavior.
- [x] 4.3 Add quick panel links to full settings routes and close the panel on navigation.
- [x] 4.4 Keep complex cache, archive, password, and file-format controls out of the quick panel.

## 5. Settings Routes

- [x] 5.1 Add route definitions for `/settings` and settings category routes.
- [x] 5.2 Create the settings route layout with category navigation.
- [x] 5.3 Move appearance controls, including theme preference and language, into `/settings/appearance`.
- [x] 5.4 Move gallery and waterfall controls that are not quick-only into `/settings/gallery`.
- [x] 5.5 Move file format and deletion behavior controls into `/settings/files`.
- [x] 5.6 Move archive password and cleanup controls into `/settings/archive`, gated by platform capability.
- [x] 5.7 Move cache policy, thumbnail sizes, folder thumbnails, and clear-cache actions into `/settings/cache`, gated by platform capability.
- [x] 5.8 Add `/settings/advanced` for any remaining low-frequency or diagnostic controls.

## 6. Remaining MUI Removal

- [x] 6.1 Replace MUI usage in HomePage, AboutPage, CachePage, DropZone, FolderSidebar, and WaterfallGrid locked-tile UI.
- [x] 6.2 Replace every MUI icon import with the selected shadcn-aligned icon package.
- [x] 6.3 Remove MUI and Emotion dependencies from package manifests and bundler dedupe lists.
- [x] 6.4 Search the source tree and confirm no `@mui/*` or `@emotion/*` imports remain.

## 7. Verification

- [x] 7.1 Run `bun run check`.
- [x] 7.2 Run `bun run build:web`.
- [ ] 7.3 Verify desktop development shell still renders if local Tauri prerequisites are available.
- [ ] 7.4 Visually inspect core flows in light, dark, and system theme modes.
- [x] 7.5 Verify existing persisted settings survive the UI relocation without key migration.
