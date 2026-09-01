import { describe, expect, test } from "bun:test";
import {
  dedupeDroppedSources,
  libraryEffectForDropBehavior,
  planDroppedOpen,
  resolveDropDisposition,
  routeAcceptsExternalDrop,
} from "../src/lib/dropPolicy";
import type { DroppedSource } from "../src/types/platform";

const folder = (locator: string, label = locator): DroppedSource => ({
  kind: "folder",
  locator,
  label,
});

const archive = (locator: string, label = locator): DroppedSource => ({
  kind: "archive",
  locator,
  label,
});

describe("external drop policy", () => {
  test("accepts library and gallery routes and ignores settings, about, and cache", () => {
    expect(routeAcceptsExternalDrop("/")).toBe(true);
    expect(routeAcceptsExternalDrop("/library")).toBe(true);
    expect(routeAcceptsExternalDrop("/library/favorites")).toBe(true);
    expect(routeAcceptsExternalDrop("/gallery")).toBe(true);
    expect(routeAcceptsExternalDrop("/settings")).toBe(false);
    expect(routeAcceptsExternalDrop("/settings/gallery")).toBe(false);
    expect(routeAcceptsExternalDrop("/about")).toBe(false);
    expect(routeAcceptsExternalDrop("/manage/cache")).toBe(false);
    expect(routeAcceptsExternalDrop("/cache")).toBe(false);
    expect(routeAcceptsExternalDrop("/en")).toBe(false);
    expect(routeAcceptsExternalDrop("/en/")).toBe(false);
    expect(routeAcceptsExternalDrop("/zh-hant/")).toBe(false);
    expect(routeAcceptsExternalDrop("/app")).toBe(false);
    expect(routeAcceptsExternalDrop("/app/")).toBe(false);
  });

  test("gives exclusive receivers priority over modal blocks and page routes", () => {
    expect(
      resolveDropDisposition({
        exclusive: true,
        modalBlocked: true,
        routeAccepts: true,
      }),
    ).toBe("exclusive");
    expect(
      resolveDropDisposition({
        exclusive: false,
        modalBlocked: true,
        routeAccepts: true,
      }),
    ).toBe("ignore");
    expect(
      resolveDropDisposition({
        exclusive: false,
        modalBlocked: false,
        routeAccepts: true,
      }),
    ).toBe("page");
    expect(
      resolveDropDisposition({
        exclusive: false,
        modalBlocked: false,
        routeAccepts: false,
      }),
    ).toBe("ignore");
  });

  test("maps drop behavior to library effects", () => {
    expect(libraryEffectForDropBehavior("add-and-open")).toBe("ensure");
    expect(libraryEffectForDropBehavior("open-only")).toBe("none");
  });

  test("opens one or more folders together and a single archive immediately", () => {
    expect(planDroppedOpen([folder("D:/a"), folder("D:/b")])).toEqual({
      action: "open",
      sources: [folder("D:/a"), folder("D:/b")],
    });
    expect(planDroppedOpen([archive("D:/pack.zip")])).toEqual({
      action: "open",
      sources: [archive("D:/pack.zip")],
    });
  });

  test("asks the user to choose for mixed or multiple archives", () => {
    expect(
      planDroppedOpen([folder("D:/a"), archive("D:/pack.zip")]).action,
    ).toBe("choose");
    expect(
      planDroppedOpen([archive("D:/one.zip"), archive("D:/two.cbz")]).action,
    ).toBe("choose");
  });

  test("dedupes repeated dropped sources", () => {
    expect(
      dedupeDroppedSources([
        folder("D:/Photos"),
        folder("D:/Photos/"),
        folder("D:\\photos"),
        archive("D:/Photos.zip"),
      ]),
    ).toEqual([folder("D:/Photos"), archive("D:/Photos.zip")]);
  });
});
