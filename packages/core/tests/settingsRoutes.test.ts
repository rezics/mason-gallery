import { describe, expect, test } from "bun:test";
import {
  SETTINGS_CATEGORIES,
  getSettingsCategory,
  getSupportedSettingsCategories,
  getVisibleSettingsCategory,
} from "../src/pages/settings/settingsRoutes";

describe("settings route visibility", () => {
  test("puts gallery before appearance", () => {
    expect(SETTINGS_CATEGORIES.slice(0, 2)).toEqual(["gallery", "appearance"]);
  });

  test("falls back unknown and unsupported direct routes to gallery", () => {
    expect(getSettingsCategory("/settings/nope")).toBe("gallery");
    expect(
      getVisibleSettingsCategory("/settings/cache", {
        canBrowseArchives: false,
      }),
    ).toBe("gallery");
  });

  test("keeps archive and cache settings visible on desktop-capable platforms", () => {
    const categories = getSupportedSettingsCategories({
      canBrowseArchives: true,
    });

    expect(categories).toContain("archive");
    expect(categories).toContain("cache");
    expect(
      getVisibleSettingsCategory("/settings/cache", {
        canBrowseArchives: true,
      }),
    ).toBe("cache");
  });
});