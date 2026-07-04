import { describe, expect, test } from "bun:test";
import {
  getSettingsCategory,
  getSupportedSettingsCategories,
  getVisibleSettingsCategory,
} from "../src/pages/settings/settingsRoutes";

describe("settings route visibility", () => {
  test("falls back unknown and unsupported direct routes to appearance", () => {
    expect(getSettingsCategory("/settings/nope")).toBe("appearance");
    expect(
      getVisibleSettingsCategory("/settings/cache", {
        canBrowseArchives: false,
      }),
    ).toBe("appearance");
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