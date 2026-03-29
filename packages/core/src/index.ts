// Context
export {
  PlatformContext,
  usePlatform,
  setPlatform,
  getPlatform,
} from "./context/PlatformContext";

// Types
export type {
  PlatformService,
  PlatformCapabilities,
  Settings,
  ImageBatch as PlatformImageBatch,
  ScanParams as PlatformScanParams,
} from "./types/platform";
export type {
  WImage,
  ImageBatch,
  ScanParams,
  SortMethod,
  Locale,
  ColumnBreakpoints,
} from "./types/index";

// Stores
export { useViewerStore } from "./stores/viewerStore";
export { useAppStore } from "./stores/appStore";
export { useSettingsStore } from "./stores/settingsStore";

// i18n
export { I18nContext, useI18n, getTranslations } from "./i18n/index";
export type { Locales, TranslationKeys } from "./i18n/index";

// Components
export { default as Shell } from "./components/Shell";
export { default as WaterfallGrid } from "./components/WaterfallGrid";
export { default as ImageViewer } from "./components/ImageViewer";
export { default as DropZone } from "./components/DropZone";
export { default as SettingsDrawer } from "./components/SettingsDrawer";
export { default as FabActions } from "./components/FabActions";

// Pages
export { default as HomePage } from "./pages/HomePage";
export { default as AboutPage } from "./pages/AboutPage";

// Lib
export {
  startScan,
  openFolderAndScan,
  refresh,
  resetToDropZone,
} from "./lib/scanActions";
