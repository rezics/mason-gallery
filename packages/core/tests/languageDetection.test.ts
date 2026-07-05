import { describe, expect, test } from "bun:test";
import { resolvePreferredLanguage } from "@mason-gallery/i18n";

describe("language detection", () => {
  test("maps browser language tags to supported locales", () => {
    expect(resolvePreferredLanguage(["zh-TW", "en-US"])).toBe("zh-hant");
    expect(resolvePreferredLanguage(["zh-CN", "en-US"])).toBe("zh-hans");
    expect(resolvePreferredLanguage(["ja-JP", "en-US"])).toBe("ja");
    expect(resolvePreferredLanguage(["fr-FR", "en-US"])).toBe("en");
  });
});