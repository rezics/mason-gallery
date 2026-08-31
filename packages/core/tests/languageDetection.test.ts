import { describe, expect, test } from "bun:test";
import {
  negotiateLanguage,
  resolvePreferredLanguage,
} from "@mason-gallery/i18n";

describe("language detection", () => {
  test("maps browser language tags to supported locales", () => {
    expect(resolvePreferredLanguage(["zh-TW", "en-US"])).toBe("zh-hant");
    expect(resolvePreferredLanguage(["zh-CN", "en-US"])).toBe("zh-hans");
    expect(resolvePreferredLanguage(["zh", "en-US"])).toBe("zh-hans");
    expect(resolvePreferredLanguage(["ja-JP", "en-US"])).toBe("ja");
    expect(resolvePreferredLanguage(["fr-FR", "en-US"])).toBe("en");
  });

  test("honors Accept-Language quality weights and exclusions", () => {
    expect(negotiateLanguage("en-US;q=0.7,zh-TW;q=0.9")).toBe("zh-hant");
    expect(negotiateLanguage("ja;q=0,en;q=0.8")).toBe("en");
    expect(negotiateLanguage("fr-FR,*;q=0.5")).toBe("en");
  });
});
