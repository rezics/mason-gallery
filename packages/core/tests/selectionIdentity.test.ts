import { describe, expect, test } from "bun:test";
import {
  identityAfterMove,
  isSelectableImage,
  normalizePathKey,
  relativePathUnderRoot,
  selectableIdentitiesInRange,
} from "../src/lib/selectionIdentity";
import type { WImage } from "../src/types";

function image(
  source: string,
  selectable?: WImage["selectableFile"],
): WImage {
  return {
    source,
    relativePath: source.split("/").pop() ?? source,
    width: 100,
    height: 100,
    selectableFile: selectable,
  };
}

describe("selection identity", () => {
  test("normalizes windows path keys case-insensitively", () => {
    expect(normalizePathKey("D:\\Photos\\A.JPG", true)).toBe("d:/photos/a.jpg");
    expect(normalizePathKey("D:/Photos/A.JPG", false)).toBe("D:/Photos/A.JPG");
  });

  test("computes relative paths under a gallery root", () => {
    expect(
      relativePathUnderRoot("D:\\Photos\\sub\\a.jpg", "D:\\Photos", true),
    ).toBe("sub/a.jpg");
    expect(relativePathUnderRoot("D:\\Other\\a.jpg", "D:\\Photos", true)).toBe(
      null,
    );
  });

  test("retargets a moved file onto a known gallery or a new package", () => {
    const inside = identityAfterMove(
      "D:\\Photos\\sorted\\a.jpg",
      [{ path: "D:\\Photos", packageKey: "d:/photos" }],
      true,
    );
    expect(inside.packageKey).toBe("d:/photos");
    expect(inside.relativePath.replace(/\\/g, "/")).toBe("sorted/a.jpg");

    const outside = identityAfterMove(
      "E:\\Inbox\\a.jpg",
      [{ path: "D:\\Photos", packageKey: "d:/photos" }],
      true,
    );
    expect(outside.packageKey).toBe("e:/inbox");
    expect(outside.relativePath).toBe("a.jpg");
  });

  test("range selection only includes selectable files", () => {
    const images = [
      image("a.jpg", {
        packageKey: "p",
        entryKey: "a",
        locator: "a.jpg",
        relativePath: "a.jpg",
      }),
      image("archive:///locked.zip"),
      image("c.jpg", {
        packageKey: "p",
        entryKey: "c",
        locator: "c.jpg",
        relativePath: "c.jpg",
      }),
    ];
    expect(selectableIdentitiesInRange(images, 0, 2).map((item) => item.entryKey)).toEqual(
      ["a", "c"],
    );
    expect(isSelectableImage(images[1]!)).toBe(false);
  });
});
