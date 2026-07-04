import type {
  AccentPreset,
  ThemePreference,
  ThemePreset,
  ThemeTokenOverrides,
} from "@/types/platform";

export type ResolvedThemeMode = "light" | "dark";

type TokenName =
  | "background"
  | "foreground"
  | "card"
  | "cardForeground"
  | "popover"
  | "popoverForeground"
  | "primary"
  | "primaryForeground"
  | "secondary"
  | "secondaryForeground"
  | "muted"
  | "mutedForeground"
  | "accent"
  | "accentForeground"
  | "destructive"
  | "destructiveForeground"
  | "border"
  | "input"
  | "ring";

export type ThemeTokens = Record<TokenName, string>;

export interface ThemePresetDefinition {
  id: ThemePreset;
  light: Omit<
    ThemeTokens,
    "primary" | "primaryForeground" | "accent" | "accentForeground" | "ring"
  >;
  dark: Omit<
    ThemeTokens,
    "primary" | "primaryForeground" | "accent" | "accentForeground" | "ring"
  >;
}

export interface AccentDefinition {
  id: Exclude<AccentPreset, "custom">;
  light: Pick<
    ThemeTokens,
    "primary" | "primaryForeground" | "accent" | "accentForeground" | "ring"
  >;
  dark: Pick<
    ThemeTokens,
    "primary" | "primaryForeground" | "accent" | "accentForeground" | "ring"
  >;
}

const FALLBACK_CUSTOM_ACCENT = "#e75b73";

const CSS_VARIABLES: Record<TokenName, string> = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  popover: "--popover",
  popoverForeground: "--popover-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  destructive: "--destructive",
  destructiveForeground: "--destructive-foreground",
  border: "--border",
  input: "--input",
  ring: "--ring",
};

export const THEME_PRESETS: Record<ThemePreset, ThemePresetDefinition> = {
  mason: {
    id: "mason",
    light: {
      background: "18 38% 98%",
      foreground: "222 36% 12%",
      card: "0 0% 100%",
      cardForeground: "222 36% 12%",
      popover: "0 0% 100%",
      popoverForeground: "222 36% 12%",
      secondary: "220 16% 93%",
      secondaryForeground: "222 28% 16%",
      muted: "220 14% 94%",
      mutedForeground: "222 12% 42%",
      destructive: "0 84% 60%",
      destructiveForeground: "0 0% 100%",
      border: "220 14% 86%",
      input: "220 14% 82%",
    },
    dark: {
      background: "222 18% 9%",
      foreground: "218 24% 92%",
      card: "222 14% 13%",
      cardForeground: "218 24% 92%",
      popover: "222 14% 12%",
      popoverForeground: "218 24% 92%",
      secondary: "220 12% 18%",
      secondaryForeground: "218 22% 90%",
      muted: "220 12% 17%",
      mutedForeground: "218 12% 66%",
      destructive: "0 72% 50%",
      destructiveForeground: "0 0% 100%",
      border: "220 10% 23%",
      input: "220 10% 26%",
    },
  },
  graphite: {
    id: "graphite",
    light: {
      background: "210 17% 97%",
      foreground: "220 18% 11%",
      card: "0 0% 100%",
      cardForeground: "220 18% 11%",
      popover: "0 0% 100%",
      popoverForeground: "220 18% 11%",
      secondary: "210 12% 91%",
      secondaryForeground: "220 14% 16%",
      muted: "210 12% 93%",
      mutedForeground: "220 8% 42%",
      destructive: "0 76% 56%",
      destructiveForeground: "0 0% 100%",
      border: "214 11% 84%",
      input: "214 11% 80%",
    },
    dark: {
      background: "220 9% 7%",
      foreground: "210 16% 92%",
      card: "220 8% 11%",
      cardForeground: "210 16% 92%",
      popover: "220 8% 10%",
      popoverForeground: "210 16% 92%",
      secondary: "220 7% 17%",
      secondaryForeground: "210 14% 90%",
      muted: "220 7% 16%",
      mutedForeground: "210 8% 64%",
      destructive: "0 68% 48%",
      destructiveForeground: "0 0% 100%",
      border: "220 7% 22%",
      input: "220 7% 25%",
    },
  },
  midnight: {
    id: "midnight",
    light: {
      background: "215 28% 97%",
      foreground: "226 32% 12%",
      card: "0 0% 100%",
      cardForeground: "226 32% 12%",
      popover: "0 0% 100%",
      popoverForeground: "226 32% 12%",
      secondary: "217 22% 91%",
      secondaryForeground: "226 25% 16%",
      muted: "217 22% 93%",
      mutedForeground: "224 12% 42%",
      destructive: "0 78% 55%",
      destructiveForeground: "0 0% 100%",
      border: "219 17% 84%",
      input: "219 17% 80%",
    },
    dark: {
      background: "229 30% 8%",
      foreground: "220 34% 93%",
      card: "228 24% 12%",
      cardForeground: "220 34% 93%",
      popover: "228 26% 11%",
      popoverForeground: "220 34% 93%",
      secondary: "229 18% 18%",
      secondaryForeground: "220 28% 91%",
      muted: "229 18% 17%",
      mutedForeground: "220 16% 68%",
      destructive: "0 70% 50%",
      destructiveForeground: "0 0% 100%",
      border: "229 16% 24%",
      input: "229 16% 27%",
    },
  },
  paper: {
    id: "paper",
    light: {
      background: "48 24% 98%",
      foreground: "230 18% 13%",
      card: "0 0% 100%",
      cardForeground: "230 18% 13%",
      popover: "0 0% 100%",
      popoverForeground: "230 18% 13%",
      secondary: "45 18% 92%",
      secondaryForeground: "230 14% 18%",
      muted: "45 16% 94%",
      mutedForeground: "230 8% 42%",
      destructive: "0 76% 55%",
      destructiveForeground: "0 0% 100%",
      border: "42 14% 84%",
      input: "42 14% 80%",
    },
    dark: {
      background: "225 12% 9%",
      foreground: "42 18% 92%",
      card: "225 10% 13%",
      cardForeground: "42 18% 92%",
      popover: "225 10% 12%",
      popoverForeground: "42 18% 92%",
      secondary: "225 8% 18%",
      secondaryForeground: "42 14% 90%",
      muted: "225 8% 17%",
      mutedForeground: "42 8% 66%",
      destructive: "0 68% 49%",
      destructiveForeground: "0 0% 100%",
      border: "225 8% 23%",
      input: "225 8% 26%",
    },
  },
  custom: {
    id: "custom",
    light: {} as ThemePresetDefinition["light"],
    dark: {} as ThemePresetDefinition["dark"],
  },
};

export const ACCENT_PRESETS: Record<
  Exclude<AccentPreset, "custom">,
  AccentDefinition
> = {
  rose: {
    id: "rose",
    light: accent("355 82% 64%", "0 0% 100%", "355 82% 95%", "355 66% 34%"),
    dark: accent("355 82% 66%", "0 0% 100%", "355 40% 22%", "355 94% 84%"),
  },
  blue: {
    id: "blue",
    light: accent("217 82% 56%", "0 0% 100%", "217 82% 95%", "217 66% 32%"),
    dark: accent("217 86% 65%", "222 36% 10%", "217 42% 22%", "217 96% 84%"),
  },
  amber: {
    id: "amber",
    light: accent("38 92% 50%", "222 36% 10%", "41 90% 93%", "34 82% 28%"),
    dark: accent("41 92% 58%", "222 36% 10%", "38 54% 21%", "42 96% 82%"),
  },
  emerald: {
    id: "emerald",
    light: accent("158 64% 40%", "0 0% 100%", "158 60% 93%", "158 64% 25%"),
    dark: accent("158 66% 52%", "222 36% 9%", "158 42% 19%", "158 78% 82%"),
  },
  violet: {
    id: "violet",
    light: accent("262 76% 60%", "0 0% 100%", "262 76% 95%", "262 62% 35%"),
    dark: accent("262 82% 70%", "222 36% 9%", "262 38% 24%", "262 95% 86%"),
  },
};

export const THEME_PRESET_IDS = [
  "mason",
  "graphite",
  "midnight",
  "paper",
] as const;

export const ACCENT_PRESET_IDS = [
  "rose",
  "blue",
  "amber",
  "emerald",
  "violet",
] as const;

function accent(
  primary: string,
  primaryForeground: string,
  accentColor: string,
  accentForeground: string,
) {
  return {
    primary,
    primaryForeground,
    accent: accentColor,
    accentForeground,
    ring: primary,
  };
}

export function resolveThemeMode(
  preference: ThemePreference,
  systemDark: boolean,
): ResolvedThemeMode {
  return preference === "dark" || (preference === "system" && systemDark)
    ? "dark"
    : "light";
}

export function isThemePreset(value: unknown): value is ThemePreset {
  return typeof value === "string" && value in THEME_PRESETS;
}

export function isAccentPreset(value: unknown): value is AccentPreset {
  return (
    value === "custom" || (typeof value === "string" && value in ACCENT_PRESETS)
  );
}

export function normalizeCustomAccent(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r = "", g = "", b = ""] = trimmed.toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return FALLBACK_CUSTOM_ACCENT;
}

export function resolveThemeTokens({
  mode,
  preset,
  accentPreset,
  customAccent,
  customTheme,
}: {
  mode: ResolvedThemeMode;
  preset: ThemePreset;
  accentPreset: AccentPreset;
  customAccent: string;
  customTheme?: { light?: ThemeTokenOverrides; dark?: ThemeTokenOverrides };
}): ThemeTokens {
  const safePreset = preset === "custom" ? "graphite" : preset;
  const surfaceTokens = THEME_PRESETS[safePreset][mode];
  const accentTokens =
    accentPreset === "custom"
      ? customAccentTokens(mode, normalizeCustomAccent(customAccent))
      : ACCENT_PRESETS[accentPreset][mode];
  const overrides = preset === "custom" ? customTheme?.[mode] : undefined;

  return {
    ...surfaceTokens,
    ...accentTokens,
    ...mapCustomOverrides(overrides),
  };
}

export function applyThemeTokens(
  element: HTMLElement,
  tokens: ThemeTokens,
  mode: ResolvedThemeMode,
  preset: ThemePreset,
  accentPreset: AccentPreset,
) {
  for (const token of Object.keys(CSS_VARIABLES) as TokenName[]) {
    element.style.setProperty(CSS_VARIABLES[token], tokens[token]);
  }
  element.classList.toggle("dark", mode === "dark");
  element.dataset.theme = mode;
  element.dataset.themePreset = preset;
  element.dataset.accent = accentPreset;
}

function mapCustomOverrides(
  overrides?: ThemeTokenOverrides,
): Partial<ThemeTokens> {
  const next: Partial<ThemeTokens> = {};
  if (!overrides) return next;
  if (overrides.background) next.background = overrides.background;
  if (overrides.foreground) {
    next.foreground = overrides.foreground;
    next.cardForeground = overrides.foreground;
    next.popoverForeground = overrides.foreground;
  }
  if (overrides.card) next.card = overrides.card;
  if (overrides.popover) next.popover = overrides.popover;
  if (overrides.muted) next.muted = overrides.muted;
  if (overrides.mutedForeground)
    next.mutedForeground = overrides.mutedForeground;
  if (overrides.border) next.border = overrides.border;
  return next;
}

function customAccentTokens(
  mode: ResolvedThemeMode,
  hex: string,
): Pick<
  ThemeTokens,
  "primary" | "primaryForeground" | "accent" | "accentForeground" | "ring"
> {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const primary = `${hsl.h} ${hsl.s}% ${hsl.l}%`;
  const primaryForeground = readableForeground(rgb);
  const accentLightness = mode === "dark" ? 22 : 94;
  const accentSaturation = Math.max(36, Math.min(hsl.s, 88));
  const accentForegroundLightness = mode === "dark" ? 84 : 30;

  return accent(
    primary,
    primaryForeground,
    `${hsl.h} ${accentSaturation}% ${accentLightness}%`,
    `${hsl.h} ${Math.max(48, accentSaturation)}% ${accentForegroundLightness}%`,
  );
}

function hexToRgb(hex: string) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    if (max === gn) h = (bn - rn) / delta + 2;
    if (max === bn) h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function readableForeground({ r, g, b }: { r: number; g: number; b: number }) {
  const luminance = relativeLuminance(r, g, b);
  return luminance > 0.42 ? "222 36% 10%" : "0 0% 100%";
}

function relativeLuminance(r: number, g: number, b: number) {
  const values = [r, g, b].map((v) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  const [rr = 0, gg = 0, bb = 0] = values;
  return 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
}
