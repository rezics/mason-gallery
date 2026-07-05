import { describe, expect, test } from "bun:test";
import { i18n } from "../src/i18n/index";

describe("i18n runtime", () => {
  test("resolves Chinese locale resource keys instead of falling back to English", async () => {
    await i18n.changeLanguage("zh-hant");
    expect(i18n.resolvedLanguage).toBe("zh-hant");
    expect(i18n.t("home:webEmptyTitle")).toBe("圖庫是空的");
    expect(i18n.t("settings:preferences")).toBe("偏好設定");

    await i18n.changeLanguage("zh-hans");
    expect(i18n.resolvedLanguage).toBe("zh-hans");
    expect(i18n.t("home:webEmptyTitle")).toBe("图库为空");
  });
});