import { z } from "zod";
import type { ColumnBreakpoints } from "@/types";
import type { Settings } from "@/types/platform";

export const SETTINGS_SCHEMA_VERSION = 2 as const;
export const SETTINGS_SCHEMA_V1_VERSION = 1 as const;

const thumbnailSizesSchema = z
  .array(z.number().int().positive().max(4096))
  .min(1)
  .transform((values) => [...new Set(values)].sort((a, b) => a - b));

const columnBreakpointsSchema = z.custom<ColumnBreakpoints>(
  (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    const entries = Object.entries(value);
    return (
      entries.length > 0 &&
      entries.some(([width]) => width === "0") &&
      entries.every(
        ([width, columns]) =>
          /^(0|[1-9]\d*)$/.test(width) &&
          typeof columns === "number" &&
          Number.isInteger(columns) &&
          columns > 0,
      )
    );
  },
  { message: "Expected positive column counts keyed by non-negative widths" },
);

const gallerySourceShortcutSchema = z
  .object({
    kind: z.enum(["folder", "archive"]),
    path: z.string().min(1),
    label: z.string().min(1),
    lastOpenedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

const extractedPolicySchema = z
  .object({
    mode: z.enum(["no-cache", "lru-capped", "unlimited"]),
    maxSizePerSource: z.number().int().nonnegative().optional(),
    minFileSize: z.number().int().nonnegative().optional(),
  })
  .strict();

const thumbnailPolicySchema = z
  .object({
    retain: z.enum(["until-source-removed", "lru-capped"]),
    maxTotalSize: z.number().int().nonnegative().optional(),
  })
  .strict();

const settingsFields = {
  formats: z.array(z.string().regex(/^\.[a-z0-9]+$/i)).min(1),
  sortMethod: z.enum(["name-asc", "name-desc", "time-asc", "time-desc"]),
  pageSize: z.number().int().positive().max(1000),
  language: z.enum(["en", "zh-hans", "zh-hant", "ja"]),
  theme: z.enum(["system", "light", "dark"]),
  breakpoints: columnBreakpointsSchema,
  showGridPosition: z.boolean(),
  openGallerySidebarByDefault: z.boolean(),
  confirmDelete: z.boolean(),
  showDeleteToast: z.boolean(),
  cacheCleanupStrategy: z.enum(["auto-clean", "keep-all"]),
  passwordStorageMode: z.enum(["none", "master"]),
  cachePolicy: z
    .object({
      extracted: extractedPolicySchema,
      thumbnails: thumbnailPolicySchema,
      thumbnailSizes: thumbnailSizesSchema,
    })
    .strict(),
  folderThumbnails: z.enum(["off", "lazy"]),
  recentSources: z.array(gallerySourceShortcutSchema).max(8),
  favoriteSources: z.array(gallerySourceShortcutSchema).max(24),
};

/**
 * Version 1 documents omit `autoCheckUpdates`. Unknown keys are stripped so
 * unpublished preview fields (theme presets) are dropped instead of
 * discarding the rest of a valid v1 document.
 */
const settingsV1Schema = z.object(settingsFields);

export const settingsSchema: z.ZodType<Settings> = z
  .object({
    ...settingsFields,
    autoCheckUpdates: z.boolean(),
  })
  .strict();

export const settingsEnvelopeSchema = z
  .object({
    version: z.literal(SETTINGS_SCHEMA_VERSION),
    settings: settingsSchema,
  })
  .strict();

export type SettingsEnvelope = z.infer<typeof settingsEnvelopeSchema>;

const DEFAULT_SETTINGS: Settings = settingsSchema.parse({
  formats: [".webp", ".jxl", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".jfif"],
  sortMethod: "name-asc",
  pageSize: 50,
  language: "en",
  theme: "system",
  breakpoints: {
    0: 1,
    500: 2,
    800: 3,
    1200: 4,
    1600: 5,
    1920: 6,
    2560: 7,
  },
  showGridPosition: true,
  openGallerySidebarByDefault: false,
  confirmDelete: true,
  showDeleteToast: true,
  cacheCleanupStrategy: "auto-clean",
  passwordStorageMode: "none",
  cachePolicy: {
    extracted: { mode: "unlimited" },
    thumbnails: { retain: "until-source-removed" },
    thumbnailSizes: [800],
  },
  folderThumbnails: "off",
  recentSources: [],
  favoriteSources: [],
  autoCheckUpdates: true,
});

export function createDefaultSettings(): Settings {
  return settingsSchema.parse(DEFAULT_SETTINGS);
}

export function createSettingsEnvelope(settings: Settings): SettingsEnvelope {
  return settingsEnvelopeSchema.parse({
    version: SETTINGS_SCHEMA_VERSION,
    settings,
  });
}

function migrateV1Settings(settings: unknown): Settings {
  const parsed = settingsV1Schema.parse(settings);
  return settingsSchema.parse({
    ...parsed,
    autoCheckUpdates: true,
  });
}

/**
 * The single migration boundary for persisted settings documents.
 *
 * Version 1 has no pre-release legacy branch: those key/value formats were
 * discarded by each platform adapter. Version 2 adds `autoCheckUpdates`,
 * defaulting it on so existing desktop installs keep auto-checking.
 */
export function migrateSettingsEnvelope(value: unknown): SettingsEnvelope {
  const header = z
    .looseObject({
      version: z.number().int().nonnegative(),
      settings: z.unknown(),
    })
    .safeParse(value);

  if (!header.success) {
    throw new Error("Persisted settings are missing a schema version");
  }

  if (header.data.version === SETTINGS_SCHEMA_V1_VERSION) {
    return createSettingsEnvelope(migrateV1Settings(header.data.settings));
  }

  if (header.data.version !== SETTINGS_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported settings schema version: ${header.data.version}`,
    );
  }

  return settingsEnvelopeSchema.parse(value);
}
