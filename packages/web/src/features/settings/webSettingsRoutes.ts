export const WEB_SETTINGS_CATEGORIES = ["appearance", "gallery"] as const;

export type WebSettingsCategory = (typeof WEB_SETTINGS_CATEGORIES)[number];

export function getWebSettingsCategory(path: string): WebSettingsCategory {
  const segment = path.split("/").filter(Boolean).at(1);
  return WEB_SETTINGS_CATEGORIES.includes(segment as WebSettingsCategory)
    ? (segment as WebSettingsCategory)
    : "appearance";
}
