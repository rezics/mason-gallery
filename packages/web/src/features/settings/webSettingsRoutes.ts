export const WEB_SETTINGS_CATEGORIES = [
  "general",
  "gallery",
  "appearance",
] as const;

export type WebSettingsCategory = (typeof WEB_SETTINGS_CATEGORIES)[number];

export const DEFAULT_WEB_SETTINGS_CATEGORY: WebSettingsCategory = "general";

export function getWebSettingsCategory(path: string): WebSettingsCategory {
  const segments = path.split("/").filter(Boolean);
  const settingsIndex = segments.indexOf("settings");
  const segment = settingsIndex >= 0 ? segments[settingsIndex + 1] : undefined;
  return WEB_SETTINGS_CATEGORIES.includes(segment as WebSettingsCategory)
    ? (segment as WebSettingsCategory)
    : DEFAULT_WEB_SETTINGS_CATEGORY;
}
