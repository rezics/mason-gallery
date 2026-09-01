import { describe, expect, test } from "bun:test";
import {
  getActiveBreakpoint,
  getColumnCount,
  resolveBreakpointWidth,
} from "../src/lib/columnBreakpoints";
import { createDefaultSettings } from "../src/persistence/settingsSchema";
import type { ColumnBreakpoints } from "../src/types";

const breakpoints = createDefaultSettings().breakpoints;

describe("column breakpoints", () => {
  test("picks the highest min-width that the current width satisfies", () => {
    expect(getActiveBreakpoint(0, breakpoints)).toEqual({
      minWidth: 0,
      columns: 1,
    });
    expect(getActiveBreakpoint(499, breakpoints)).toEqual({
      minWidth: 0,
      columns: 1,
    });
    expect(getActiveBreakpoint(500, breakpoints)).toEqual({
      minWidth: 500,
      columns: 2,
    });
    expect(getActiveBreakpoint(1199, breakpoints)).toEqual({
      minWidth: 800,
      columns: 3,
    });
    expect(getActiveBreakpoint(1200, breakpoints)).toEqual({
      minWidth: 1200,
      columns: 4,
    });
    expect(getActiveBreakpoint(1919, breakpoints)).toEqual({
      minWidth: 1600,
      columns: 5,
    });
    expect(getActiveBreakpoint(1920, breakpoints)).toEqual({
      minWidth: 1920,
      columns: 6,
    });
    expect(getActiveBreakpoint(3000, breakpoints)).toEqual({
      minWidth: 2560,
      columns: 7,
    });
  });

  test("getColumnCount returns the active breakpoint's column count", () => {
    expect(getColumnCount(1400, breakpoints)).toBe(4);
    expect(getColumnCount(800, breakpoints)).toBe(3);
    expect(getColumnCount(2560, breakpoints)).toBe(7);
  });

  test("falls back to one column when no breakpoint matches", () => {
    const sparse: ColumnBreakpoints = { 800: 3, 1200: 4 };
    expect(getActiveBreakpoint(500, sparse)).toEqual({
      minWidth: 0,
      columns: 1,
    });
    expect(getColumnCount(500, sparse)).toBe(1);
  });

  test("uses the gallery pane width when the grid has measured it", () => {
    expect(
      resolveBreakpointWidth({ galleryWidth: 1100, viewportWidth: 1600 }),
    ).toBe(1100);
    expect(
      resolveBreakpointWidth({ galleryWidth: null, viewportWidth: 1600 }),
    ).toBe(1600);
    expect(
      resolveBreakpointWidth({ galleryWidth: 0, viewportWidth: 1600 }),
    ).toBe(1600);
  });
});
