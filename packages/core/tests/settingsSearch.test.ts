import { describe, expect, test } from "bun:test";
import { resources } from "@mason-gallery/i18n";
import {
  buildSettingsSearchEntries,
  createSettingsSearch,
} from "../src/pages/settings/settingDefinitions";
import { SETTINGS_CATEGORIES } from "../src/pages/settings/settingsRoutes";
import type { PlatformCapabilities } from "../src/types/platform";

const capabilities: PlatformCapabilities = {
  canDeleteFiles: false,
  canRevealFile: false,
  canSelectFolder: true,
  hasCustomTitlebar: false,
  canAutoUpdate: false,
  canDragDropFolders: true,
  canBrowseArchives: false,
  canBatchMoveFiles: false,
  hasSystemIntegration: false,
};
const translate = (language: keyof typeof resources) => (key: string) => {
  const [namespace, name] = key.split(":");
  const strings = resources[language][
    namespace as keyof typeof resources.en
  ] as Record<string, string>;
  return strings[name] ?? key;
};
describe("settings metadata search", () => {
  test("wheel navigation aliases find a concrete preset and image actions in Chinese", () => {
    const search = createSettingsSearch(
      buildSettingsSearchEntries(translate("zh-hans"), capabilities, [
        "general",
        "gallery",
        "appearance",
        "controls",
      ]),
    );
    expect(search("滚轮翻图")[0]?.id).toBe("inputPreset");
    expect(search("上一张")[0]?.id).toBe("viewer.previous");
    expect(search("翻页").some((entry) => entry.id === "inputPreset")).toBe(
      true,
    );
  });
  test("filters unavailable platform capabilities and categories before indexing", () => {
    const entries = buildSettingsSearchEntries(translate("en"), capabilities, [
      "general",
      "gallery",
      "appearance",
      "controls",
    ]);
    expect(
      entries.some(
        (entry) =>
          entry.id === "updates" ||
          entry.id === "viewer.delete" ||
          entry.id === "grid.selectAll",
      ),
    ).toBe(false);
    expect(
      entries.every(
        (entry) =>
          entry.category !== "cache" && entry.category !== "integration",
      ),
    ).toBe(true);
    expect(createSettingsSearch(entries)("languge")[0]?.id).toBe("language");
  });
  test("all supported languages resolve every search label and alias", () => {
    for (const language of Object.keys(
      resources,
    ) as (keyof typeof resources)[]) {
      const entries = buildSettingsSearchEntries(
        translate(language),
        {
          ...capabilities,
          canDeleteFiles: true,
          canRevealFile: true,
          canAutoUpdate: true,
          canBrowseArchives: true,
          canBatchMoveFiles: true,
          hasSystemIntegration: true,
        },
        SETTINGS_CATEGORIES,
      );
      for (const entry of entries) {
        expect(entry.label).not.toContain(":");
        expect(entry.keywords).not.toContain("settings:");
      }
    }
  });
});
