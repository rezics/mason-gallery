import { z } from "zod";
import type { SelectableFileIdentity } from "@/types";
import type {
  MoveConflictPolicy,
  MoveFilesRequest,
  MoveItemResult,
  MoveProgress,
  PersistedSelectionEntry,
  PersistedSelectionState,
  SelectableFileProbe,
  SelectionEntryKey,
} from "@/types/platform";

const isoDateTime = z.iso.datetime({ offset: true });

export const selectableFileIdentitySchema: z.ZodType<SelectableFileIdentity> = z
  .object({
    packageKey: z.string().min(1),
    entryKey: z.string().min(1),
    locator: z.string().min(1),
    relativePath: z.string().min(1),
  })
  .strict();

export const persistedSelectionEntrySchema: z.ZodType<PersistedSelectionEntry> =
  z
    .object({
      packageKey: z.string().min(1),
      entryKey: z.string().min(1),
      locator: z.string().min(1),
      relativePath: z.string().min(1),
      selectedAt: isoDateTime,
      lastSeenAt: isoDateTime.nullable(),
    })
    .strict();

export const persistedSelectionStateSchema: z.ZodType<PersistedSelectionState> =
  z
    .object({
      modeEnabled: z.boolean(),
      entries: z.array(persistedSelectionEntrySchema),
    })
    .strict();

export const selectionEntryKeySchema: z.ZodType<SelectionEntryKey> = z
  .object({
    packageKey: z.string().min(1),
    entryKey: z.string().min(1),
  })
  .strict();

export const moveConflictPolicySchema: z.ZodType<MoveConflictPolicy> = z.enum([
  "keep-both",
  "skip",
]);

export const moveFilesRequestSchema: z.ZodType<MoveFilesRequest> = z
  .object({
    operationId: z.string().min(1),
    destinationDirectory: z.string().min(1),
    conflictPolicy: moveConflictPolicySchema,
    items: z.array(
      z
        .object({
          entryKey: z.string().min(1),
          sourcePath: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict();

export const moveProgressSchema: z.ZodType<MoveProgress> = z
  .object({
    operationId: z.string().min(1),
    completed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    succeeded: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  })
  .strict();

export const moveItemResultSchema: z.ZodType<MoveItemResult> =
  z.discriminatedUnion("status", [
    z
      .object({
        status: z.literal("moved"),
        entryKey: z.string().min(1),
        sourcePath: z.string().min(1),
        destinationPath: z.string().min(1),
      })
      .strict(),
    z
      .object({
        status: z.literal("skipped"),
        entryKey: z.string().min(1),
        sourcePath: z.string().min(1),
        reason: z.enum(["conflict", "same-location", "cancelled"]),
      })
      .strict(),
    z
      .object({
        status: z.literal("copied-not-removed"),
        entryKey: z.string().min(1),
        sourcePath: z.string().min(1),
        destinationPath: z.string().min(1),
        message: z.string().min(1),
      })
      .strict(),
    z
      .object({
        status: z.literal("failed"),
        entryKey: z.string().min(1),
        sourcePath: z.string().min(1),
        code: z.enum([
          "missing",
          "permission-denied",
          "invalid-source",
          "invalid-destination",
          "io",
        ]),
        message: z.string().min(1),
      })
      .strict(),
  ]);

export const selectableFileProbeSchema: z.ZodType<SelectableFileProbe> = z
  .object({
    locator: z.string().min(1),
    available: z.boolean(),
  })
  .strict();

export const EMPTY_SELECTION_STATE: PersistedSelectionState = {
  modeEnabled: false,
  entries: [],
};

export function parseSelectionState(value: unknown): PersistedSelectionState {
  return persistedSelectionStateSchema.parse(value);
}

export function parseMoveItemResults(value: unknown): MoveItemResult[] {
  return z.array(moveItemResultSchema).parse(value);
}

export function parseSelectableFileProbes(
  value: unknown,
): SelectableFileProbe[] {
  return z.array(selectableFileProbeSchema).parse(value);
}

/** Field names that must stay aligned across TypeScript, Zod, and IPC JSON. */
export const SELECTION_ENTRY_FIELD_NAMES = [
  "packageKey",
  "entryKey",
  "locator",
  "relativePath",
  "selectedAt",
  "lastSeenAt",
] as const;

export const MOVE_ITEM_STATUS_NAMES = [
  "moved",
  "skipped",
  "copied-not-removed",
  "failed",
] as const;
