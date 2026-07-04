import { describe, expect, test } from "bun:test";
import {
  applyThemeTokens,
  isAccentPreset,
  isThemePreset,
  normalizeCustomAccent,
  resolveThemeMode,
  resolveThemeTokens,
} from "../src/lib/theme";

function createFakeElement() {
  const properties = new Map<string, string>();
  const classes = new Set<string>();
  const dataset: Record<string, string> = {};

  const element = {
    dataset,
    style: {
      setProperty(name: string, value: string) {
        properties.set(name, value);
      },
    },
    classList: {
      toggle(name: string, force?: boolean) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
    },
  } as unknown as HTMLElement;

  return { element, properties, classes, dataset };
}

describe("theme tokens", () => {
  test("normalizes and validates persisted theme choices", () => {
    expect(isThemePreset("graphite")).toBe(true);
    expect(isThemePreset("unknown")).toBe(false);
    expect(isAccentPreset("custom")).toBe(true);
    expect(isAccentPreset("orange")).toBe(false);
    expect(normalizeCustomAccent(" #ABC ")).toBe("#aabbcc");
    expect(normalizeCustomAccent("nope")).toBe("#e75b73");
  });

  test("resolves system mode and custom accent into complete tokens", () => {
    expect(resolveThemeMode("system", true)).toBe("dark");
    expect(resolveThemeMode("system", false)).toBe("light");

    const tokens = resolveThemeTokens({
      mode: "dark",
      preset: "midnight",
      accentPreset: "custom",
      customAccent: "#10b981",
    });

    expect(tokens.background).toBe("229 30% 8%");
    expect(tokens.primary).toBe("160 84% 39%");
    expect(tokens.primaryForeground).toBe("0 0% 100%");
    expect(tokens.ring).toBe(tokens.primary);
  });

  test("applies tokens to the document element without a reload", () => {
    const tokens = resolveThemeTokens({
      mode: "dark",
      preset: "graphite",
      accentPreset: "blue",
      customAccent: "#e75b73",
    });
    const { element, properties, classes, dataset } = createFakeElement();

    applyThemeTokens(element, tokens, "dark", "graphite", "blue");

    expect(properties.get("--background")).toBe(tokens.background);
    expect(properties.get("--primary")).toBe(tokens.primary);
    expect(classes.has("dark")).toBe(true);
    expect(dataset.theme).toBe("dark");
    expect(dataset.themePreset).toBe("graphite");
    expect(dataset.accent).toBe("blue");
  });
});