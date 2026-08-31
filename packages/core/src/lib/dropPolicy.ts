import { normalizeSourceLocator } from "@/lib/sourceLabel";
import type {
  DroppedSource,
  ExternalDropBehavior,
  LibraryEffect,
} from "@/types/platform";

export type DropDisposition = "exclusive" | "page" | "ignore";

export type DroppedOpenPlan =
  | { action: "none" }
  | { action: "open"; sources: DroppedSource[] }
  | { action: "choose"; sources: DroppedSource[] };

export function normalizeRoutePath(path: string): string {
  const withoutQuery = path.split("?")[0] ?? path;
  const trimmed = withoutQuery.replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : "/";
}

export function routeAcceptsExternalDrop(path: string): boolean {
  const normalized = normalizeRoutePath(path);
  if (normalized === "/" || normalized === "/gallery") return true;
  if (normalized === "/library" || normalized.startsWith("/library/")) {
    return true;
  }
  return false;
}

export function resolveDropDisposition(input: {
  exclusive: boolean;
  modalBlocked: boolean;
  routeAccepts: boolean;
}): DropDisposition {
  if (input.exclusive) return "exclusive";
  if (input.modalBlocked) return "ignore";
  if (input.routeAccepts) return "page";
  return "ignore";
}

export function libraryEffectForDropBehavior(
  behavior: ExternalDropBehavior,
): LibraryEffect {
  return behavior === "open-only" ? "none" : "ensure";
}

export function droppedSourceKey(
  source: Pick<DroppedSource, "kind" | "locator">,
): string {
  return `${source.kind}:${normalizeSourceLocator(source.locator)}`;
}

export function dedupeDroppedSources(
  sources: DroppedSource[],
): DroppedSource[] {
  const seen = new Set<string>();
  const unique: DroppedSource[] = [];
  for (const source of sources) {
    const key = droppedSourceKey(source);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(source);
  }
  return unique;
}

export function planDroppedOpen(sources: DroppedSource[]): DroppedOpenPlan {
  if (sources.length === 0) return { action: "none" };

  const folders = sources.filter((source) => source.kind === "folder");
  const archives = sources.filter((source) => source.kind === "archive");

  if (archives.length === 0) {
    return { action: "open", sources: folders };
  }
  if (folders.length === 0 && archives.length === 1 && archives[0]) {
    return { action: "open", sources: archives };
  }
  return { action: "choose", sources };
}
