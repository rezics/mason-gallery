import { describe, expect, test } from "bun:test";
import {
  WEB_SETTINGS_CATEGORIES,
  getWebSettingsCategory,
} from "../src/features/settings/webSettingsRoutes";

describe("web settings routes", () => {
  test("puts gallery before appearance", () => {
    expect(WEB_SETTINGS_CATEGORIES).toEqual(["gallery", "appearance"]);
  });

  test("falls desktop-only or unknown settings routes back to gallery", () => {
    expect(getWebSettingsCategory("/settings/archive")).toBe("gallery");
    expect(getWebSettingsCategory("/settings/cache")).toBe("gallery");
    expect(getWebSettingsCategory("/settings/nope")).toBe("gallery");
    expect(getWebSettingsCategory("/settings/gallery")).toBe("gallery");
    expect(getWebSettingsCategory("/settings/appearance")).toBe("appearance");
  });

  test("accepts an optional locale prefix", () => {
    expect(getWebSettingsCategory("/zh-hant/settings/appearance")).toBe(
      "appearance",
    );
    expect(getWebSettingsCategory("/ja/settings/nope")).toBe("gallery");
  });

  test("accepts the noindex app settings prefix", () => {
    expect(getWebSettingsCategory("/app/settings/appearance")).toBe(
      "appearance",
    );
    expect(getWebSettingsCategory("/app/settings/gallery")).toBe("gallery");
  });
});
