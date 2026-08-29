import { describe, expect, test } from "bun:test";
import {
  getInitialWebLanguage,
  getLocalizedWebPath,
  getWebLocaleFromPathname,
  getWebLocaleFromSearch,
} from "../src/features/i18n/webLocaleRoutes";

describe("web locale routes", () => {
  test("reads supported locale prefixes from entry and about URLs", () => {
    expect(getWebLocaleFromPathname("/zh-hant/")).toBe("zh-hant");
    expect(getWebLocaleFromPathname("/ja/about")).toBe("ja");
    expect(getWebLocaleFromPathname("/jp")).toBeUndefined();
    expect(getWebLocaleFromPathname("/jpfdsfadfasf")).toBeUndefined();
    expect(getWebLocaleFromPathname("/settings/gallery")).toBeUndefined();
  });

  test("builds localized entry and about paths", () => {
    expect(getLocalizedWebPath("/", "zh-hans")).toBe("/zh-hans/");
    expect(getLocalizedWebPath("/about", "zh-hans")).toBe(
      "/zh-hans/about/",
    );
    expect(getLocalizedWebPath("/", "en")).toBe("/");
    expect(getLocalizedWebPath("/about", undefined)).toBe("/about/");
  });

  test("prefers URL locale, then stored language, then browser language", () => {
    expect(getInitialWebLanguage("/zh-hant/about", "en")).toBe("zh-hant");
    expect(getInitialWebLanguage("/", "ja")).toBe("ja");
  });

  test("uses an explicit app language query before stored preferences", () => {
    expect(getWebLocaleFromSearch("?lang=zh-hans")).toBe("zh-hans");
    expect(getWebLocaleFromSearch("?lang=unsupported")).toBeUndefined();
    expect(getInitialWebLanguage("/app/", "en", "?lang=ja")).toBe("ja");
  });
});
