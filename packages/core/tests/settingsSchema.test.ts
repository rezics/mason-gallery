import { describe, expect, test } from "bun:test";
import {
  createDefaultSettings,
  createSettingsEnvelope,
  migrateSettingsEnvelope,
  settingsSchema,
} from "../src/persistence/settingsSchema";

describe("settings schema", () => {
  test("round-trips the current versioned envelope", () => {
    const settings = createDefaultSettings();
    const envelope = createSettingsEnvelope(settings);

    expect(migrateSettingsEnvelope(envelope)).toEqual(envelope);
  });

  test("rejects unsupported and unversioned persisted documents", () => {
    expect(() => migrateSettingsEnvelope({ settings: {} })).toThrow();
    expect(() =>
      migrateSettingsEnvelope({ version: 2, settings: {} }),
    ).toThrow("Unsupported settings schema version: 2");
  });

  test("rejects the removed duplicate thumbnailSizes field", () => {
    const oldDocument = {
      ...createDefaultSettings(),
      thumbnailSizes: [320, 640],
    };

    expect(settingsSchema.safeParse(oldDocument).success).toBe(false);
  });

  test("keeps schema v1 while invalidating the unpublished theme presets", () => {
    const oldV1Envelope = {
      version: 1,
      settings: {
        ...createDefaultSettings(),
        themePreset: "mason",
        accentPreset: "rose",
        customAccent: "#e75b73",
        customTheme: {},
      },
    };

    expect(() => migrateSettingsEnvelope(oldV1Envelope)).toThrow();
  });

  test("rejects the removed plaintext password mode", () => {
    expect(
      settingsSchema.safeParse({
        ...createDefaultSettings(),
        passwordStorageMode: "plaintext",
      }).success,
    ).toBe(false);
  });

  test("canonicalizes authoritative thumbnail widths", () => {
    const parsed = settingsSchema.parse({
      ...createDefaultSettings(),
      cachePolicy: {
        ...createDefaultSettings().cachePolicy,
        thumbnailSizes: [800, 320, 800],
      },
    });

    expect(parsed.cachePolicy.thumbnailSizes).toEqual([320, 800]);
  });
});
