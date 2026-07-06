import { describe, expect, test } from "bun:test";
import {
  getInitialWebLanguage,
  getLocalizedWebPath,
  getWebLocaleFromPathname,
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
    expect(getLocalizedWebPath("/about", "zh-hans")).toBe("/zh-hans/about");
    expect(getLocalizedWebPath("/about", undefined)).toBe("/about");
  });

  test("prefers URL locale, then stored language, then browser language", () => {
    expect(getInitialWebLanguage("/zh-hant/about", "en")).toBe("zh-hant");
    expect(getInitialWebLanguage("/", "ja")).toBe("ja");
  });
});