import { describe, expect, test } from "bun:test";
import {
  createDefaultSettings,
  createSettingsEnvelope,
  migrateSettingsEnvelope,
  SETTINGS_SCHEMA_VERSION,
  settingsSchema,
} from "../src/persistence/settingsSchema";

function createV1Settings() {
  const { autoCheckUpdates: _autoCheckUpdates, ...settings } =
    createDefaultSettings();
  return settings;
}

describe("settings schema", () => {
  test("round-trips the current versioned envelope", () => {
    const settings = createDefaultSettings();
    const envelope = createSettingsEnvelope(settings);

    expect(envelope.version).toBe(2);
    expect(SETTINGS_SCHEMA_VERSION).toBe(2);
    expect(settings.autoCheckUpdates).toBe(true);
    expect(migrateSettingsEnvelope(envelope)).toEqual(envelope);
  });

  test("rejects unsupported and unversioned persisted documents", () => {
    expect(() => migrateSettingsEnvelope({ settings: {} })).toThrow();
    expect(() =>
      migrateSettingsEnvelope({ version: 3, settings: {} }),
    ).toThrow("Unsupported settings schema version: 3");
  });

  test("rejects the removed duplicate thumbnailSizes field", () => {
    const oldDocument = {
      ...createDefaultSettings(),
      thumbnailSizes: [320, 640],
    };

    expect(settingsSchema.safeParse(oldDocument).success).toBe(false);
  });

  test("migrates v1 settings to v2 and keeps existing preferences", () => {
    const v1Settings = {
      ...createV1Settings(),
      language: "zh-hant" as const,
      theme: "dark" as const,
      sortMethod: "time-desc" as const,
      cachePolicy: {
        extracted: { mode: "lru-capped" as const, maxSizePerSource: 50 },
        thumbnails: { retain: "lru-capped" as const, maxTotalSize: 80 },
        thumbnailSizes: [320, 800],
      },
    };

    const migrated = migrateSettingsEnvelope({
      version: 1,
      settings: v1Settings,
    });

    expect(migrated.version).toBe(2);
    expect(migrated.settings.autoCheckUpdates).toBe(true);
    expect(migrated.settings.language).toBe("zh-hant");
    expect(migrated.settings.theme).toBe("dark");
    expect(migrated.settings.sortMethod).toBe("time-desc");
    expect(migrated.settings.cachePolicy).toEqual(v1Settings.cachePolicy);
  });

  test("drops unpublished v1 theme presets instead of discarding the document", () => {
    const v1Settings = createV1Settings();
    const migrated = migrateSettingsEnvelope({
      version: 1,
      settings: {
        ...v1Settings,
        themePreset: "mason",
        accentPreset: "rose",
        customAccent: "#e75b73",
        customTheme: {},
      },
    });

    expect(migrated.version).toBe(2);
    expect(migrated.settings.language).toBe(v1Settings.language);
    expect(migrated.settings.theme).toBe(v1Settings.theme);
    expect(
      (migrated.settings as unknown as Record<string, unknown>).themePreset,
    ).toBeUndefined();
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
