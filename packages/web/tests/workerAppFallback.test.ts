import { describe, expect, test } from "bun:test";
import {
  fetchWithAppFallback,
  isWebAppPath,
} from "../../../worker/index";

describe("web app asset fallback", () => {
  test("recognizes standalone app paths", () => {
    expect(isWebAppPath("/app")).toBe(true);
    expect(isWebAppPath("/app/")).toBe(true);
    expect(isWebAppPath("/app/settings/general/")).toBe(true);
    expect(isWebAppPath("/en/")).toBe(false);
    expect(isWebAppPath("/about")).toBe(false);
    expect(isWebAppPath("/application")).toBe(false);
  });

  test("serves the app shell when an app route is missing", async () => {
    const requested: string[] = [];
    const fetchAsset = async (request: Request) => {
      const pathname = new URL(request.url).pathname;
      requested.push(pathname);
      if (pathname === "/app/") {
        return new Response("<html>app</html>", { status: 200 });
      }
      return new Response("missing", { status: 404 });
    };

    const response = await fetchWithAppFallback(
      new Request("https://mason-gallery.rezics.com/app/settings/general/"),
      fetchAsset,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<html>app</html>");
    expect(requested).toEqual(["/app/settings/general/", "/app/"]);
  });

  test("leaves existing app files and marketing 404s unchanged", async () => {
    const fetchAsset = async (request: Request) => {
      const pathname = new URL(request.url).pathname;
      if (pathname === "/app/settings/gallery/") {
        return new Response("<html>gallery</html>", { status: 200 });
      }
      return new Response("not found", { status: 404 });
    };

    const existing = await fetchWithAppFallback(
      new Request("https://mason-gallery.rezics.com/app/settings/gallery/"),
      fetchAsset,
    );
    expect(existing.status).toBe(200);
    expect(await existing.text()).toBe("<html>gallery</html>");

    const marketing = await fetchWithAppFallback(
      new Request("https://mason-gallery.rezics.com/en/missing/"),
      fetchAsset,
    );
    expect(marketing.status).toBe(404);
    expect(await marketing.text()).toBe("not found");
  });
});
