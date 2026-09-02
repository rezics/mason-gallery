import type { PlatformCapabilities } from "@/types/platform";

export const SETTINGS_CATEGORIES = [
  "general",
  "gallery",
  "appearance",
  "files",
  "integration",
  "archive",
  "cache",
] as const;

export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number];

export const DEFAULT_SETTINGS_CATEGORY: SettingsCategory = "general";

export function getSettingsCategory(path: string): SettingsCategory {
  const segment = path.split("/")[2] as SettingsCategory | undefined;
  return segment && SETTINGS_CATEGORIES.includes(segment)
    ? segment
    : DEFAULT_SETTINGS_CATEGORY;
}

export function getSupportedSettingsCategories(
  capabilities: Pick<
    PlatformCapabilities,
    "canBrowseArchives" | "hasSystemIntegration"
  >,
): SettingsCategory[] {
  return SETTINGS_CATEGORIES.filter((item) => {
    if (item === "archive" || item === "cache") {
      return capabilities.canBrowseArchives;
    }
    if (item === "integration") {
      return capabilities.hasSystemIntegration;
    }
    return true;
  });
}

export function getVisibleSettingsCategory(
  path: string,
  capabilities: Pick<
    PlatformCapabilities,
    "canBrowseArchives" | "hasSystemIntegration"
  >,
): SettingsCategory {
  const category = getSettingsCategory(path);
  return getSupportedSettingsCategories(capabilities).includes(category)
    ? category
    : DEFAULT_SETTINGS_CATEGORY;
}
