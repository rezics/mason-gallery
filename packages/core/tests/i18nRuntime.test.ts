import { describe, expect, test } from "bun:test";
import {
  resources,
  supportedLanguages,
  type Namespace,
} from "@mason-gallery/i18n";
import { i18n } from "../src/i18n/index";
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL } from "../src/lib/projectLinks";

const requiredNamespaces = ["settings", "menu", "update", "selection"] as const satisfies Namespace[];

describe("i18n runtime", () => {
  test("resolves Chinese locale resource keys instead of falling back to English", async () => {
    await i18n.changeLanguage("zh-hant");
    expect(i18n.resolvedLanguage).toBe("zh-hant");
    expect(i18n.t("home:webEmptyTitle")).toBe("瀑布流圖片檢視器");
    expect(i18n.t("settings:preferences")).toBe("偏好設定");

    await i18n.changeLanguage("zh-hans");
    expect(i18n.resolvedLanguage).toBe("zh-hans");
    expect(i18n.t("home:webEmptyTitle")).toBe("瀑布流图片查看器");
  });

  test("keeps update and preference copy complete across locales", () => {
    for (const namespace of requiredNamespaces) {
      const englishKeys = Object.keys(resources.en[namespace]).sort();
      for (const language of supportedLanguages) {
        expect(Object.keys(resources[language][namespace]).sort()).toEqual(
          englishKeys,
        );
      }
    }

    expect(resources.en.settings.general).toBe("General");
    expect(resources.en.settings.autoCheckUpdates).toBeDefined();
    expect(resources.en.settings.externalDropBehavior).toBeDefined();
    expect(resources.en.settings.externalDropAddAndOpen).toBeDefined();
    expect(resources.en.settings.externalDropOpenOnly).toBeDefined();
    expect(resources.en.menu.checkForUpdates).toBeDefined();
    expect(resources.en.menu.feedback).toBeDefined();
    expect(resources.en.update.upToDate).toBeDefined();
    expect(resources.en.update.available.includes("{version}")).toBe(true);
  });
});

describe("project links", () => {
  test("points feedback and the repository at rezics/mason-gallery", () => {
    expect(GITHUB_REPO_URL).toBe("https://github.com/rezics/mason-gallery");
    expect(GITHUB_ISSUES_URL).toBe(
      "https://github.com/rezics/mason-gallery/issues",
    );
  });
});

