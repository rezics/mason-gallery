import { z } from "zod";
import type { DropBatch, SystemIntegrationStatus } from "@/types/platform";

const droppedSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("folder"),
      locator: z.string().min(1),
      label: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("archive"),
      locator: z.string().min(1),
      label: z.string().min(1),
    })
    .strict(),
]);

const dropRejectionSchema = z
  .object({
    label: z.string().min(1),
    reason: z.enum([
      "unsupported-type",
      "unsupported-platform",
      "missing",
      "permission-denied",
    ]),
  })
  .strict();

const dropBatchSchema = z
  .object({
    accepted: z.array(droppedSourceSchema),
    rejected: z.array(dropRejectionSchema),
  })
  .strict();

const systemIntegrationTargetStatusSchema = z.union([
  z
    .object({
      state: z.enum(["enabled", "disabled", "needs-repair"]),
      configurable: z.literal(true),
    })
    .strict(),
  z
    .object({
      state: z.literal("managed"),
      configurable: z.literal(false),
    })
    .strict(),
]);

const systemIntegrationStatusSchema = z
  .object({
    platform: z.enum(["windows", "macos", "linux"]),
    folders: systemIntegrationTargetStatusSchema,
    archives: systemIntegrationTargetStatusSchema,
  })
  .strict();

export function parseDropBatch(value: unknown): DropBatch {
  return dropBatchSchema.parse(value);
}

export function parseSystemIntegrationStatus(
  value: unknown,
): SystemIntegrationStatus {
  return systemIntegrationStatusSchema.parse(value);
}
