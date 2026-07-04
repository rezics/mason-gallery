import type { PlatformCapabilities } from "@/types/platform";

export const SETTINGS_CATEGORIES = [
  "appearance",
  "gallery",
  "files",
  "archive",
  "cache",
] as const;

export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number];

export function getSettingsCategory(path: string): SettingsCategory {
  const segment = path.split("/")[2] as SettingsCategory | undefined;
  return segment && SETTINGS_CATEGORIES.includes(segment)
    ? segment
    : "appearance";
}

export function getSupportedSettingsCategories(
  capabilities: Pick<PlatformCapabilities, "canBrowseArchives">,
): SettingsCategory[] {
  return SETTINGS_CATEGORIES.filter((item) => {
    if (item === "archive" || item === "cache") {
      return capabilities.canBrowseArchives;
    }
    return true;
  });
}

export function getVisibleSettingsCategory(
  path: string,
  capabilities: Pick<PlatformCapabilities, "canBrowseArchives">,
): SettingsCategory {
  const category = getSettingsCategory(path);
  return getSupportedSettingsCategories(capabilities).includes(category)
    ? category
    : "appearance";
}
