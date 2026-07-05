import { describe, expect, test } from "bun:test";
import {
  WEB_SETTINGS_CATEGORIES,
  getWebSettingsCategory,
} from "../src/features/settings/webSettingsRoutes";

describe("web settings routes", () => {
  test("only exposes lightweight web settings categories", () => {
    expect(WEB_SETTINGS_CATEGORIES).toEqual(["appearance", "gallery"]);
  });

  test("falls desktop-only or unknown settings routes back to appearance", () => {
    expect(getWebSettingsCategory("/settings/archive")).toBe("appearance");
    expect(getWebSettingsCategory("/settings/cache")).toBe("appearance");
    expect(getWebSettingsCategory("/settings/nope")).toBe("appearance");
    expect(getWebSettingsCategory("/settings/gallery")).toBe("gallery");
  });
});
