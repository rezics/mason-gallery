import { describe, expect, test } from "bun:test";
import {
  getLocalizedPath,
  publicLocales,
  siteContent,
} from "../src/content/siteContent";

describe("static site content", () => {
  test("provides complete content for every public locale", () => {
    for (const locale of publicLocales) {
      const content = siteContent[locale];

      expect(content.title.length).toBeGreaterThan(0);
      expect(content.description.length).toBeGreaterThan(0);
      expect(content.features).toHaveLength(4);
      expect(content.steps).toHaveLength(3);
      expect(content.faqs).toHaveLength(4);
    }
  });

  test("uses locale-prefixed canonical public routes", () => {
    expect(getLocalizedPath("en", "home")).toBe("/en/");
    expect(getLocalizedPath("en", "about")).toBe("/en/about/");
    expect(getLocalizedPath("zh-hans", "home")).toBe("/zh-hans/");
    expect(getLocalizedPath("zh-hant", "about")).toBe(
      "/zh-hant/about/",
    );
    expect(getLocalizedPath("ja", "about")).toBe("/ja/about/");
  });
});
