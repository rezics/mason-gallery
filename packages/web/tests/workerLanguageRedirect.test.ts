import { describe, expect, test } from "bun:test";
import { getLanguageRedirect } from "../../../worker/index";

describe("Cloudflare language redirects", () => {
  test("negotiates unlocalized public entries and preserves search", () => {
    const response = getLanguageRedirect(
      new Request("https://mason-gallery.rezics.com/about/?from=test", {
        headers: {
          "Accept-Language": "en-US;q=0.7,zh-TW;q=0.9",
        },
      }),
    );

    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toBe(
      "https://mason-gallery.rezics.com/zh-hant/about/?from=test",
    );
    expect(response?.headers.get("cache-control")).toBe("no-store");
    expect(response?.headers.get("vary")).toBe("Accept-Language");
  });

  test("redirects the default language to its canonical prefix", () => {
    const response = getLanguageRedirect(
      new Request("https://mason-gallery.rezics.com/"),
    );

    expect(response?.headers.get("location")).toBe(
      "https://mason-gallery.rezics.com/en/",
    );
  });

  test("passes canonical, unknown, and state-changing requests through", () => {
    expect(
      getLanguageRedirect(
        new Request("https://mason-gallery.rezics.com/ja/"),
      ),
    ).toBeUndefined();
    expect(
      getLanguageRedirect(
        new Request("https://mason-gallery.rezics.com/not-found"),
      ),
    ).toBeUndefined();
    expect(
      getLanguageRedirect(
        new Request("https://mason-gallery.rezics.com/", {
          method: "POST",
        }),
      ),
    ).toBeUndefined();
  });
});
