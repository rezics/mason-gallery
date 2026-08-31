import { describe, expect, test } from "bun:test";
import {
  MOVE_ITEM_STATUS_NAMES,
  moveItemResultSchema,
  parseMoveItemResults,
  parseSelectionState,
  persistedSelectionStateSchema,
  SELECTION_ENTRY_FIELD_NAMES,
  selectableFileIdentitySchema,
} from "../src/persistence/selectionSchema";

const identity = {
  packageKey: "d:/photos",
  entryKey: "d:/photos/a.jpg",
  locator: "D:\\photos\\a.jpg",
  relativePath: "a.jpg",
};

describe("selection schemas", () => {
  test("parses a persisted selection document with camelCase IPC fields", () => {
    const payload = {
      modeEnabled: true,
      entries: [
        {
          ...identity,
          selectedAt: "2026-08-31T10:00:00.000Z",
          lastSeenAt: null,
        },
      ],
    };
    const parsed = parseSelectionState(payload);
    expect(parsed.modeEnabled).toBe(true);
    expect(parsed.entries[0]?.entryKey).toBe(identity.entryKey);
    expect(Object.keys(parsed.entries[0] ?? {}).sort()).toEqual(
      [...SELECTION_ENTRY_FIELD_NAMES].sort(),
    );
  });

  test("rejects unknown keys and missing identity fields", () => {
    expect(() =>
      selectableFileIdentitySchema.parse({ ...identity, extra: true }),
    ).toThrow();
    expect(() =>
      persistedSelectionStateSchema.parse({
        modeEnabled: false,
        entries: [{ ...identity, selectedAt: "not-a-date", lastSeenAt: null }],
      }),
    ).toThrow();
  });

  test("keeps move result statuses distinct", () => {
    const results = parseMoveItemResults([
      {
        status: "moved",
        entryKey: "a",
        sourcePath: "D:/a.jpg",
        destinationPath: "D:/b.jpg",
      },
      {
        status: "skipped",
        entryKey: "b",
        sourcePath: "D:/b.jpg",
        reason: "conflict",
      },
      {
        status: "copied-not-removed",
        entryKey: "c",
        sourcePath: "D:/c.jpg",
        destinationPath: "E:/c.jpg",
        message: "original remains",
      },
      {
        status: "failed",
        entryKey: "d",
        sourcePath: "D:/d.jpg",
        code: "missing",
        message: "gone",
      },
    ]);
    expect(results.map((result) => result.status)).toEqual([
      ...MOVE_ITEM_STATUS_NAMES,
    ]);
    expect(moveItemResultSchema.parse(results[0]).status).toBe("moved");
  });
});
