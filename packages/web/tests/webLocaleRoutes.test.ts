import { describe, expect, test } from "bun:test";
import {
  getInitialWebLanguage,
  getLocalizedWebPath,
  getWebAppHref,
  getWebAppSettingsHref,
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
    expect(getLocalizedWebPath("/", "en")).toBe("/en/");
    expect(getLocalizedWebPath("/about", "en")).toBe("/en/about/");
  });

  test("prefers URL locale, then stored language, then browser language", () => {
    expect(getInitialWebLanguage("/zh-hant/about", "en")).toBe("zh-hant");
    expect(getInitialWebLanguage("/app/", "ja")).toBe("ja");
    expect(
      getInitialWebLanguage("/app/", undefined, "", ["zh-TW", "en-US"]),
    ).toBe("zh-hant");
  });

  test("uses an explicit app language query before stored preferences", () => {
    expect(getWebLocaleFromSearch("?lang=zh-hans")).toBe("zh-hans");
    expect(getWebLocaleFromSearch("?lang=unsupported")).toBeUndefined();
    expect(getInitialWebLanguage("/app/", "en", "?lang=ja")).toBe("ja");
  });

  test("builds app and settings hrefs with an explicit language query", () => {
    expect(getWebAppHref("en")).toBe("/app/?lang=en");
    expect(getWebAppHref("zh-hant")).toBe("/app/?lang=zh-hant");
    expect(getWebAppSettingsHref("ja")).toBe(
      "/app/settings/general/?lang=ja",
    );
    expect(getWebAppSettingsHref("en", "gallery")).toBe(
      "/app/settings/gallery/?lang=en",
    );
  });
});
