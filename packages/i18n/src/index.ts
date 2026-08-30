import enAbout from "./locales/en/about.json";
import enActions from "./locales/en/actions.json";
import enArchive from "./locales/en/archive.json";
import enCache from "./locales/en/cache.json";
import enCommon from "./locales/en/common.json";
import enHome from "./locales/en/home.json";
import enLibrary from "./locales/en/library.json";
import enMenu from "./locales/en/menu.json";
import enSettings from "./locales/en/settings.json";
import enSidebar from "./locales/en/sidebar.json";
import enUpdate from "./locales/en/update.json";
import enViewer from "./locales/en/viewer.json";
import jaAbout from "./locales/ja/about.json";
import jaActions from "./locales/ja/actions.json";
import jaArchive from "./locales/ja/archive.json";
import jaCache from "./locales/ja/cache.json";
import jaCommon from "./locales/ja/common.json";
import jaHome from "./locales/ja/home.json";
import jaLibrary from "./locales/ja/library.json";
import jaMenu from "./locales/ja/menu.json";
import jaSettings from "./locales/ja/settings.json";
import jaSidebar from "./locales/ja/sidebar.json";
import jaUpdate from "./locales/ja/update.json";
import jaViewer from "./locales/ja/viewer.json";
import zhHansAbout from "./locales/zh-hans/about.json";
import zhHansActions from "./locales/zh-hans/actions.json";
import zhHansArchive from "./locales/zh-hans/archive.json";
import zhHansCache from "./locales/zh-hans/cache.json";
import zhHansCommon from "./locales/zh-hans/common.json";
import zhHansHome from "./locales/zh-hans/home.json";
import zhHansLibrary from "./locales/zh-hans/library.json";
import zhHansMenu from "./locales/zh-hans/menu.json";
import zhHansSettings from "./locales/zh-hans/settings.json";
import zhHansSidebar from "./locales/zh-hans/sidebar.json";
import zhHansUpdate from "./locales/zh-hans/update.json";
import zhHansViewer from "./locales/zh-hans/viewer.json";
import zhHantAbout from "./locales/zh-hant/about.json";
import zhHantActions from "./locales/zh-hant/actions.json";
import zhHantArchive from "./locales/zh-hant/archive.json";
import zhHantCache from "./locales/zh-hant/cache.json";
import zhHantCommon from "./locales/zh-hant/common.json";
import zhHantHome from "./locales/zh-hant/home.json";
import zhHantLibrary from "./locales/zh-hant/library.json";
import zhHantMenu from "./locales/zh-hant/menu.json";
import zhHantSettings from "./locales/zh-hant/settings.json";
import zhHantSidebar from "./locales/zh-hant/sidebar.json";
import zhHantUpdate from "./locales/zh-hant/update.json";
import zhHantViewer from "./locales/zh-hant/viewer.json";

export const namespaces = [
  "common",
  "menu",
  "home",
  "settings",
  "viewer",
  "about",
  "actions",
  "sidebar",
  "update",
  "archive",
  "cache",
  "library",
] as const;

export const defaultNamespace = "common";
export const supportedLanguages = ["en", "zh-hans", "zh-hant", "ja"] as const;
export const fallbackLanguage = "en";

export type Namespace = (typeof namespaces)[number];
export type SupportedLanguage = (typeof supportedLanguages)[number];
export type NamespaceMessages = Record<string, string>;
export type TranslationResource = Record<Namespace, NamespaceMessages>;

export const languageLabels: Record<SupportedLanguage, string> = {
  en: "English",
  "zh-hans": "简体中文",
  "zh-hant": "繁體中文",
  ja: "日本語",
};

const supportedLanguageSet = new Set<string>(supportedLanguages);

export function isSupportedLanguage(
  value: unknown,
): value is SupportedLanguage {
  return typeof value === "string" && supportedLanguageSet.has(value);
}

export function resolvePreferredLanguage(
  values: Iterable<unknown>,
  defaultLanguage: SupportedLanguage = fallbackLanguage,
): SupportedLanguage {
  for (const value of values) {
    if (typeof value !== "string") continue;

    const normalized = value.toLowerCase().replace("_", "-");
    if (isSupportedLanguage(normalized)) return normalized;

    const [language, region] = normalized.split("-");
    if (language === "zh") {
      return region === "tw" || region === "hk" || region === "mo"
        ? "zh-hant"
        : "zh-hans";
    }
    if (language === "ja") return "ja";
    if (language === "en") return "en";
  }

  return defaultLanguage;
}

export function resolveSupportedLanguage(
  value: unknown,
  defaultLanguage: SupportedLanguage = fallbackLanguage,
): SupportedLanguage {
  return isSupportedLanguage(value) ? value : defaultLanguage;
}

export const resources: Record<SupportedLanguage, TranslationResource> = {
  en: {
    common: enCommon,
    menu: enMenu,
    home: enHome,
    settings: enSettings,
    viewer: enViewer,
    about: enAbout,
    actions: enActions,
    sidebar: enSidebar,
    update: enUpdate,
    archive: enArchive,
    cache: enCache,
    library: enLibrary,
  },
  "zh-hans": {
    common: zhHansCommon,
    menu: zhHansMenu,
    home: zhHansHome,
    settings: zhHansSettings,
    viewer: zhHansViewer,
    about: zhHansAbout,
    actions: zhHansActions,
    sidebar: zhHansSidebar,
    update: zhHansUpdate,
    archive: zhHansArchive,
    cache: zhHansCache,
    library: zhHansLibrary,
  },
  "zh-hant": {
    common: zhHantCommon,
    menu: zhHantMenu,
    home: zhHantHome,
    settings: zhHantSettings,
    viewer: zhHantViewer,
    about: zhHantAbout,
    actions: zhHantActions,
    sidebar: zhHantSidebar,
    update: zhHantUpdate,
    archive: zhHantArchive,
    cache: zhHantCache,
    library: zhHantLibrary,
  },
  ja: {
    common: jaCommon,
    menu: jaMenu,
    home: jaHome,
    settings: jaSettings,
    viewer: jaViewer,
    about: jaAbout,
    actions: jaActions,
    sidebar: jaSidebar,
    update: jaUpdate,
    archive: jaArchive,
    cache: jaCache,
    library: jaLibrary,
  },
};
