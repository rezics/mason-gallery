import { describe, expect, test } from "bun:test";
import {
  parseDropBatch,
  parseSystemIntegrationStatus,
} from "../src/lib/platformPayloads";

describe("platform IPC payload parsing", () => {
  test("accepts validated external open batches", () => {
    expect(
      parseDropBatch({
        accepted: [
          {
            kind: "archive",
            locator: "D:/Books/volume.cbz",
            label: "volume.cbz",
          },
        ],
        rejected: [],
      }),
    ).toEqual({
      accepted: [
        {
          kind: "archive",
          locator: "D:/Books/volume.cbz",
          label: "volume.cbz",
        },
      ],
      rejected: [],
    });
  });

  test("rejects malformed integration states at the IPC boundary", () => {
    expect(() =>
      parseSystemIntegrationStatus({
        platform: "windows",
        folders: { state: "enabled", configurable: true },
        archives: { state: "unknown", configurable: true },
      }),
    ).toThrow();
  });

  test("rejects unknown fields instead of silently weakening the contract", () => {
    expect(() =>
      parseDropBatch({
        accepted: [],
        rejected: [],
        untrusted: true,
      }),
    ).toThrow();
  });

  test("accepts platform-managed integration states", () => {
    expect(
      parseSystemIntegrationStatus({
        platform: "macos",
        folders: { state: "managed", configurable: false },
        archives: { state: "managed", configurable: false },
      }).platform,
    ).toBe("macos");
  });

  test("rejects contradictory integration registration states", () => {
    expect(() =>
      parseSystemIntegrationStatus({
        platform: "linux",
        folders: { state: "managed", configurable: true },
        archives: { state: "enabled", configurable: false },
      }),
    ).toThrow();
  });
});
