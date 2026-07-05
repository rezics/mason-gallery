import { isSupportedLanguage } from "@mason-gallery/i18n";

export const WEB_SETTINGS_CATEGORIES = ["gallery", "appearance"] as const;

export type WebSettingsCategory = (typeof WEB_SETTINGS_CATEGORIES)[number];

const DEFAULT_WEB_SETTINGS_CATEGORY: WebSettingsCategory = "gallery";

export function getWebSettingsCategory(path: string): WebSettingsCategory {
  const segments = path.split("/").filter(Boolean);
  const settingsIndex = isSupportedLanguage(segments[0]) ? 1 : 0;
  const segment = segments[settingsIndex + 1];
  return WEB_SETTINGS_CATEGORIES.includes(segment as WebSettingsCategory)
    ? (segment as WebSettingsCategory)
    : DEFAULT_WEB_SETTINGS_CATEGORY;
}
