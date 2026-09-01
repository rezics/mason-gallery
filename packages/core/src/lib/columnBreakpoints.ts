import type { ColumnBreakpoints } from "@/types";

export interface ActiveColumnBreakpoint {
  minWidth: number;
  columns: number;
}

const FALLBACK_ACTIVE: ActiveColumnBreakpoint = {
  minWidth: 0,
  columns: 1,
};

export function getActiveBreakpoint(
  width: number,
  breakpoints: ColumnBreakpoints,
): ActiveColumnBreakpoint {
  const keys = Object.keys(breakpoints)
    .map(Number)
    .sort((a, b) => b - a);
  if (keys.length === 0) return FALLBACK_ACTIVE;

  const maxColumns = Math.max(...Object.values(breakpoints), 1);
  for (const minWidth of keys) {
    if (width >= minWidth) {
      return {
        minWidth,
        columns: Math.min(breakpoints[minWidth] ?? 1, maxColumns),
      };
    }
  }

  return FALLBACK_ACTIVE;
}

export function getColumnCount(
  width: number,
  breakpoints: ColumnBreakpoints,
): number {
  return getActiveBreakpoint(width, breakpoints).columns;
}

/** Prefer the gallery pane width the grid actually lays out against. */
export function resolveBreakpointWidth(input: {
  galleryWidth: number | null;
  viewportWidth: number;
}): number {
  return input.galleryWidth != null && input.galleryWidth > 0
    ? input.galleryWidth
    : input.viewportWidth;
}
