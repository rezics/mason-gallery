import { describe, expect, test } from "bun:test";
import {
  SETTINGS_CATEGORIES,
  getSettingsCategory,
  getSupportedSettingsCategories,
  getVisibleSettingsCategory,
} from "../src/pages/settings/settingsRoutes";

describe("settings route visibility", () => {
  test("puts general first as the default settings page", () => {
    expect(SETTINGS_CATEGORIES[0]).toBe("general");
    expect(SETTINGS_CATEGORIES.slice(0, 3)).toEqual([
      "general",
      "gallery",
      "appearance",
    ]);
    expect(getSettingsCategory("/settings")).toBe("general");
    expect(getSettingsCategory("/settings/general")).toBe("general");
  });

  test("falls back unknown and unsupported direct routes to general", () => {
    expect(getSettingsCategory("/settings/nope")).toBe("general");
    expect(
      getVisibleSettingsCategory("/settings/cache", {
        canBrowseArchives: false,
        hasSystemIntegration: false,
      }),
    ).toBe("general");
  });

  test("keeps archive and cache settings visible on desktop-capable platforms", () => {
    const categories = getSupportedSettingsCategories({
      canBrowseArchives: true,
      hasSystemIntegration: false,
    });

    expect(categories).toContain("archive");
    expect(categories).toContain("cache");
    expect(
      getVisibleSettingsCategory("/settings/cache", {
        canBrowseArchives: true,
        hasSystemIntegration: false,
      }),
    ).toBe("cache");
  });

  test("shows system integration only when the platform can provide it", () => {
    expect(
      getSupportedSettingsCategories({
        canBrowseArchives: true,
        hasSystemIntegration: true,
      }),
    ).toContain("integration");
    expect(
      getSupportedSettingsCategories({
        canBrowseArchives: true,
        hasSystemIntegration: false,
      }),
    ).not.toContain("integration");
  });
});
