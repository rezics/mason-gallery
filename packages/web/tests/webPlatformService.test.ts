import { describe, expect, test } from "bun:test";
import { getWebImageSource } from "../src/adapters/WebPlatformService";

describe("web platform image sources", () => {
  test("keeps source ids stable for the same root and relative path", () => {
    expect(getWebImageSource(0, "album/photo.jpg")).toBe(
      getWebImageSource(0, "album/photo.jpg"),
    );
  });

  test("separates equal relative paths from different dropped roots", () => {
    expect(getWebImageSource(0, "photo.jpg")).not.toBe(
      getWebImageSource(1, "photo.jpg"),
    );
  });
});