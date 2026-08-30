import type { ThemePreference } from "@/types/platform";

export type ResolvedThemeMode = Exclude<ThemePreference, "system">;

export function resolveThemeMode(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedThemeMode {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }
  return preference;
}

/**
 * Rhea owns all visual tokens in CSS. Runtime theming only selects its native
 * light or dark token set so controls never drift into a second design system.
 */
export function applyThemeMode(
  element: HTMLElement,
  mode: ResolvedThemeMode,
): void {
  element.classList.toggle("dark", mode === "dark");
  element.dataset.theme = mode;
  element.style.colorScheme = mode;
}
