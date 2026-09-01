import { describe, expect, test } from "bun:test";
import {
  parsePendingWebAppOpen,
  PENDING_WEB_APP_OPEN_KEY,
  stashPendingWebAppOpen,
  takePendingWebAppOpen,
} from "../src/features/gallery/webAppLaunch";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("pending web app open payload", () => {
  test("accepts folder sources and a library effect", () => {
    expect(
      parsePendingWebAppOpen({
        sources: [
          { kind: "folder", locator: "web-folder://abc", label: "photos" },
        ],
        libraryEffect: "ensure",
      }),
    ).toEqual({
      sources: [
        { kind: "folder", locator: "web-folder://abc", label: "photos" },
      ],
      libraryEffect: "ensure",
    });
  });

  test("rejects malformed or empty payloads", () => {
    expect(parsePendingWebAppOpen(null)).toBeUndefined();
    expect(parsePendingWebAppOpen("nope")).toBeUndefined();
    expect(
      parsePendingWebAppOpen({
        sources: [],
        libraryEffect: "ensure",
      }),
    ).toBeUndefined();
    expect(
      parsePendingWebAppOpen({
        sources: [{ kind: "folder", locator: "", label: "photos" }],
        libraryEffect: "ensure",
      }),
    ).toBeUndefined();
    expect(
      parsePendingWebAppOpen({
        sources: [
          { kind: "folder", locator: "web-folder://abc", label: "photos" },
        ],
        libraryEffect: "maybe",
      }),
    ).toBeUndefined();
  });

  test("stashes and consumes a one-shot payload", () => {
    const storage = new MemoryStorage();
    stashPendingWebAppOpen(
      {
        sources: [
          { kind: "folder", locator: "web-folder://abc", label: "photos" },
        ],
        libraryEffect: "none",
      },
      storage,
    );
    expect(storage.getItem(PENDING_WEB_APP_OPEN_KEY)).toBeTruthy();

    expect(takePendingWebAppOpen(storage)).toEqual({
      sources: [
        { kind: "folder", locator: "web-folder://abc", label: "photos" },
      ],
      libraryEffect: "none",
    });
    expect(storage.getItem(PENDING_WEB_APP_OPEN_KEY)).toBeNull();
    expect(takePendingWebAppOpen(storage)).toBeUndefined();
  });

  test("drops unreadable stored JSON instead of throwing", () => {
    const storage = new MemoryStorage();
    storage.setItem(PENDING_WEB_APP_OPEN_KEY, "{not-json");
    expect(takePendingWebAppOpen(storage)).toBeUndefined();
    expect(storage.getItem(PENDING_WEB_APP_OPEN_KEY)).toBeNull();
  });
});
