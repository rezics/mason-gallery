import { describe, expect, test } from "bun:test";
import {
  ARCHIVE_EXTENSION_NAMES,
  ARCHIVE_EXTENSIONS,
  isArchiveFileName,
} from "../src/lib/archiveFormats";

describe("shared archive formats", () => {
  test("names the desktop-supported archive suffixes once", () => {
    expect(ARCHIVE_EXTENSIONS).toEqual([".zip", ".rar", ".7z", ".cbz", ".cbr"]);
    expect(ARCHIVE_EXTENSION_NAMES).toEqual(["zip", "rar", "7z", "cbz", "cbr"]);
    expect(isArchiveFileName("Moonlight.cbz")).toBe(true);
    expect(isArchiveFileName("looks-like.zip")).toBe(true);
    expect(isArchiveFileName("folder")).toBe(false);
    expect(isArchiveFileName("photo.jpg")).toBe(false);
  });
});
