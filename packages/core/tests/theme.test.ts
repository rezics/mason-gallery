import { describe, expect, test } from "bun:test";
import { applyThemeMode, resolveThemeMode } from "../src/lib/theme";

function createFakeElement() {
  const classes = new Set<string>();
  const dataset: Record<string, string> = {};
  const style: Record<string, string> = {};

  const element = {
    dataset,
    style,
    classList: {
      toggle(name: string, force?: boolean) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
    },
  } as unknown as HTMLElement;

  return { element, classes, dataset, style };
}

describe("Rhea theme mode", () => {
  test("resolves system, light, and dark preferences", () => {
    expect(resolveThemeMode("system", true)).toBe("dark");
    expect(resolveThemeMode("system", false)).toBe("light");
    expect(resolveThemeMode("light", true)).toBe("light");
    expect(resolveThemeMode("dark", false)).toBe("dark");
  });

  test("selects the native dark token set without inline color overrides", () => {
    const { element, classes, dataset, style } = createFakeElement();

    applyThemeMode(element, "dark");
    expect(classes.has("dark")).toBe(true);
    expect(dataset.theme).toBe("dark");
    expect(style.colorScheme).toBe("dark");

    applyThemeMode(element, "light");
    expect(classes.has("dark")).toBe(false);
    expect(dataset.theme).toBe("light");
    expect(style.colorScheme).toBe("light");
  });
});
