import Fuse from "fuse.js";
import { ACTIONS } from "@/input/bindings";
import type { PlatformCapabilities } from "@/types/platform";
import type { SettingsCategory } from "./settingsRoutes";

export interface SettingDefinition {
  id: string;
  category: SettingsCategory;
  labelKey: string;
  descriptionKey?: string;
  keywordKeys?: string[];
  anchor: string;
  fallbackAnchor?: string;
  capability?: keyof PlatformCapabilities;
}
const field = (
  category: SettingsCategory,
  id: string,
  labelKey: string,
  descriptionKey?: string,
  capability?: keyof PlatformCapabilities,
): SettingDefinition => ({
  id,
  category,
  labelKey,
  descriptionKey,
  capability,
  anchor: `setting-${id}`,
});
export const SETTING_DEFINITIONS: SettingDefinition[] = [
  field("general", "language", "settings:language"),
  field(
    "general",
    "updates",
    "settings:checkForUpdates",
    undefined,
    "canAutoUpdate",
  ),
  field(
    "general",
    "autoCheckUpdates",
    "settings:autoCheckUpdates",
    undefined,
    "canAutoUpdate",
  ),
  field("appearance", "theme", "settings:themeMode"),
  field(
    "gallery",
    "externalDropBehavior",
    "settings:externalDropBehavior",
    undefined,
    "canDragDropFolders",
  ),
  field("gallery", "sortMethod", "settings:sortMethod"),
  field("gallery", "pageSize", "settings:pageSize"),
  field("gallery", "showGridPosition", "settings:showGridPosition"),
  field(
    "gallery",
    "openGallerySidebarByDefault",
    "settings:openGallerySidebarByDefault",
  ),
  field("gallery", "columns", "settings:columns"),
  field("files", "formats", "settings:formats", "settings:formatsHint"),
  field(
    "files",
    "confirmDelete",
    "settings:confirmDelete",
    undefined,
    "canDeleteFiles",
  ),
  field(
    "files",
    "showDeleteToast",
    "settings:showDeleteToast",
    undefined,
    "canDeleteFiles",
  ),
  {
    ...field(
      "integration",
      "systemIntegrationMaster",
      "settings:systemIntegrationMaster",
      "settings:systemIntegrationNoDefaultHint",
      "hasSystemIntegration",
    ),
    fallbackAnchor: "setting-systemIntegrationFolders",
  },
  field(
    "integration",
    "systemIntegrationFolders",
    "settings:systemIntegrationFolders",
    "settings:systemIntegrationFoldersHint",
    "hasSystemIntegration",
  ),
  field(
    "integration",
    "systemIntegrationArchives",
    "settings:systemIntegrationArchives",
    "settings:systemIntegrationArchivesHint",
    "hasSystemIntegration",
  ),
  field("archive", "cacheCleanup", "archive:cacheCleanup"),
  field("archive", "passwordStorage", "archive:passwordStorage"),
  field("cache", "extractedMode", "cache:extractedMode"),
  {
    ...field(
      "cache",
      "extractedMaxSizePerSource",
      "cache:extractedMaxSizePerSource",
    ),
    fallbackAnchor: "setting-extractedMode",
  },
  {
    ...field("cache", "extractedMinFileSize", "cache:extractedMinFileSize"),
    fallbackAnchor: "setting-extractedMode",
  },
  field("cache", "thumbnailRetention", "cache:thumbnailRetention"),
  {
    ...field("cache", "thumbnailMaxTotalSize", "cache:thumbnailMaxTotalSize"),
    fallbackAnchor: "setting-thumbnailRetention",
  },
  field(
    "cache",
    "thumbnailSizes",
    "cache:thumbnailSizes",
    "cache:thumbnailSizesHint",
  ),
  field(
    "cache",
    "folderThumbnails",
    "cache:folderThumbnails",
    "cache:folderThumbnailsHint",
  ),
  field(
    "cache",
    "clearThumbs",
    "cache:clearThumbs",
    "cache:clearThumbsConfirm",
  ),
  field(
    "cache",
    "clearExtracted",
    "cache:clearExtracted",
    "cache:clearExtractedConfirm",
  ),
  {
    id: "inputPreset",
    category: "controls",
    labelKey: "settings:inputPreset",
    descriptionKey: "settings:inputPresetHint",
    keywordKeys: [
      "settings:wheelSearchAliases",
      "settings:preset_wheel-navigation",
    ],
    anchor: "input-preset",
  },
  ...ACTIONS.map(
    (action): SettingDefinition => ({
      id: action.id,
      category: "controls",
      labelKey: action.labelKey,
      descriptionKey: `settings:scope_${action.scope}`,
      keywordKeys: [
        "settings:shortcutSearchAliases",
        ...(action.id === "viewer.previous" || action.id === "viewer.next"
          ? ["settings:wheelSearchAliases"]
          : []),
        ...(action.id === "viewer.zoomIn"
          ? ["settings:zoomInSearchAliases"]
          : []),
        ...(action.id === "viewer.zoomOut"
          ? ["settings:zoomOutSearchAliases"]
          : []),
      ],
      anchor: action.id.replace(".", "-"),
      capability: action.capability,
    }),
  ),
];
export interface SettingSearchEntry extends SettingDefinition {
  label: string;
  description: string;
  categoryLabel: string;
  keywords: string;
}
export function buildSettingsSearchEntries(
  translate: (key: string) => string,
  capabilities: PlatformCapabilities,
  categories: readonly SettingsCategory[],
): SettingSearchEntry[] {
  return SETTING_DEFINITIONS.filter(
    (definition) =>
      categories.includes(definition.category) &&
      (!definition.capability || capabilities[definition.capability]),
  ).map((definition) => ({
    ...definition,
    label: translate(definition.labelKey),
    description: definition.descriptionKey
      ? translate(definition.descriptionKey)
      : "",
    categoryLabel: translate(
      definition.category === "integration"
        ? "settings:systemIntegration"
        : definition.category === "archive"
          ? "archive:settingsSection"
          : definition.category === "cache"
            ? "cache:section"
            : `settings:${definition.category}`,
    ),
    keywords: (definition.keywordKeys ?? []).map(translate).join(" "),
  }));
}
export function createSettingsSearch(entries: SettingSearchEntry[]) {
  const fuse = new Fuse(entries, {
    ignoreLocation: true,
    threshold: 0.28,
    keys: [
      { name: "label", weight: 0.45 },
      { name: "keywords", weight: 0.35 },
      { name: "categoryLabel", weight: 0.1 },
      { name: "description", weight: 0.1 },
    ],
  });
  return (query: string): SettingSearchEntry[] => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    const rank = (entry: SettingSearchEntry) =>
      entry.label.toLocaleLowerCase() === normalized
        ? 0
        : entry.label.toLocaleLowerCase().includes(normalized)
          ? 1
          : entry.keywords.toLocaleLowerCase().includes(normalized)
            ? 2
            : 3;
    const exact = entries
      .filter((entry) =>
        [
          entry.label,
          entry.keywords,
          entry.categoryLabel,
          entry.description,
        ].some((value) => value.toLocaleLowerCase().includes(normalized)),
      )
      .sort((a, b) => rank(a) - rank(b));
    const seen = new Set(exact.map((entry) => entry.id));
    const fuzzy =
      normalized.length <= 2 &&
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(normalized)
        ? []
        : fuse
            .search(normalized)
            .map(({ item }) => item)
            .filter((entry) => !seen.has(entry.id));
    return [...exact, ...fuzzy].slice(0, 12);
  };
}
