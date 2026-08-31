import { describe, expect, test } from "bun:test";
import {
  WEB_SETTINGS_CATEGORIES,
  getWebSettingsCategory,
} from "../src/features/settings/webSettingsRoutes";

describe("web settings routes", () => {
  test("puts general first as the default settings page", () => {
    expect(WEB_SETTINGS_CATEGORIES).toEqual([
      "general",
      "gallery",
      "appearance",
    ]);
    expect(getWebSettingsCategory("/settings")).toBe("general");
    expect(getWebSettingsCategory("/settings/general")).toBe("general");
  });

  test("falls desktop-only or unknown settings routes back to general", () => {
    expect(getWebSettingsCategory("/settings/archive")).toBe("general");
    expect(getWebSettingsCategory("/settings/cache")).toBe("general");
    expect(getWebSettingsCategory("/settings/nope")).toBe("general");
    expect(getWebSettingsCategory("/settings/gallery")).toBe("gallery");
    expect(getWebSettingsCategory("/settings/appearance")).toBe("appearance");
  });

  test("accepts an optional locale prefix", () => {
    expect(getWebSettingsCategory("/zh-hant/settings/appearance")).toBe(
      "appearance",
    );
    expect(getWebSettingsCategory("/ja/settings/nope")).toBe("general");
  });

  test("accepts the noindex app settings prefix", () => {
    expect(getWebSettingsCategory("/app/settings/appearance")).toBe(
      "appearance",
    );
    expect(getWebSettingsCategory("/app/settings/gallery")).toBe("gallery");
    expect(getWebSettingsCategory("/app/settings/general")).toBe("general");
  });
});
