import type { DroppedSource, LibraryEffect } from "@mason-gallery/core";

export const PENDING_WEB_APP_OPEN_KEY = "mason-gallery:pending-web-app-open";

export type PendingWebAppOpen = {
  sources: DroppedSource[];
  libraryEffect: LibraryEffect;
};

type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseLibraryEffect(value: unknown): LibraryEffect | undefined {
  if (value === "ensure" || value === "touch" || value === "none") {
    return value;
  }
  return undefined;
}

function parseDroppedSource(value: unknown): DroppedSource | undefined {
  if (!isRecord(value)) return undefined;
  if (value.kind !== "folder" && value.kind !== "archive") return undefined;
  if (typeof value.locator !== "string" || value.locator.length === 0) {
    return undefined;
  }
  if (typeof value.label !== "string" || value.label.length === 0) {
    return undefined;
  }
  return {
    kind: value.kind,
    locator: value.locator,
    label: value.label,
  };
}

export function parsePendingWebAppOpen(
  value: unknown,
): PendingWebAppOpen | undefined {
  if (!isRecord(value)) return undefined;
  const libraryEffect = parseLibraryEffect(value.libraryEffect);
  if (!libraryEffect || !Array.isArray(value.sources)) return undefined;

  const sources: DroppedSource[] = [];
  for (const item of value.sources) {
    const source = parseDroppedSource(item);
    if (!source) return undefined;
    sources.push(source);
  }
  if (sources.length === 0) return undefined;

  return { sources, libraryEffect };
}

export function stashPendingWebAppOpen(
  pending: PendingWebAppOpen,
  storage: SessionStorageLike | undefined = globalThis.sessionStorage,
): void {
  try {
    storage?.setItem(PENDING_WEB_APP_OPEN_KEY, JSON.stringify(pending));
  } catch {
    // sessionStorage can throw in private/locked contexts.
  }
}

export function takePendingWebAppOpen(
  storage: SessionStorageLike | undefined = globalThis.sessionStorage,
): PendingWebAppOpen | undefined {
  if (!storage) return undefined;

  try {
    const raw = storage.getItem(PENDING_WEB_APP_OPEN_KEY);
    storage.removeItem(PENDING_WEB_APP_OPEN_KEY);
    if (!raw) return undefined;
    return parsePendingWebAppOpen(JSON.parse(raw));
  } catch {
    return undefined;
  }
}
