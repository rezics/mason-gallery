import { languageLabels, supportedLanguages } from "@mason-gallery/i18n";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { useI18n } from "@/i18n";
import { ACCENT_PRESET_IDS, THEME_PRESET_IDS } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Locale } from "@/types";
import type {
  AccentPreset,
  ThemePreference,
  ThemePreset,
} from "@/types/platform";
import { SettingsField, SettingsSection } from "./SettingsField";

const accentSwatches: Record<Exclude<AccentPreset, "custom">, string> = {
  rose: "#e75b73",
  blue: "#3b82f6",
  amber: "#f59e0b",
  emerald: "#10b981",
  violet: "#8b5cf6",
};

export function AppearanceSettingsSection() {
  const t = useI18n();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const themePreset = useSettingsStore((s) => s.themePreset);
  const setThemePreset = useSettingsStore((s) => s.setThemePreset);
  const accentPreset = useSettingsStore((s) => s.accentPreset);
  const setAccentPreset = useSettingsStore((s) => s.setAccentPreset);
  const customAccent = useSettingsStore((s) => s.customAccent);
  const setCustomAccent = useSettingsStore((s) => s.setCustomAccent);

  const themePresetLabels: Record<ThemePreset, string> = {
    mason: t("settings:presetMason"),
    graphite: t("settings:presetGraphite"),
    midnight: t("settings:presetMidnight"),
    paper: t("settings:presetPaper"),
    custom: t("settings:customAccent"),
  };

  const accentLabels: Record<AccentPreset, string> = {
    rose: t("settings:accentRose"),
    blue: t("settings:accentBlue"),
    amber: t("settings:accentAmber"),
    emerald: t("settings:accentEmerald"),
    violet: t("settings:accentViolet"),
    custom: t("settings:customAccent"),
  };

  return (
    <SettingsSection>
      <SettingsField label={t("settings:themeMode")}>
        <Select
          value={theme}
          onChange={(event) => setTheme(event.target.value as ThemePreference)}
        >
          <option value="system">{t("settings:modeSystem")}</option>
          <option value="light">{t("settings:modeLight")}</option>
          <option value="dark">{t("settings:modeDark")}</option>
        </Select>
      </SettingsField>

      <SettingsField label={t("settings:themePreset")}>
        <div className="grid gap-2 sm:grid-cols-2">
          {THEME_PRESET_IDS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={cn(
                "flex min-h-20 items-start justify-between rounded-md border border-border bg-background p-3 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                themePreset === preset &&
                  "border-primary bg-accent text-accent-foreground",
              )}
              onClick={() => setThemePreset(preset)}
            >
              <span className="font-medium">{themePresetLabels[preset]}</span>
              {themePreset === preset && <Check className="size-4" />}
            </button>
          ))}
        </div>
      </SettingsField>

      <SettingsField label={t("settings:accentColor")}>
        <div className="flex flex-wrap gap-2">
          {ACCENT_PRESET_IDS.map((preset) => (
            <button
              key={preset}
              type="button"
              title={accentLabels[preset]}
              className={cn(
                "flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2 text-sm hover:bg-accent hover:text-accent-foreground",
                accentPreset === preset && "border-primary",
              )}
              onClick={() => setAccentPreset(preset)}
            >
              <span
                className="size-5 rounded-full border border-black/10"
                style={{ backgroundColor: accentSwatches[preset] }}
              />
              {accentLabels[preset]}
              {accentPreset === preset && <Check className="size-4" />}
            </button>
          ))}
          <button
            type="button"
            className={cn(
              "flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2 text-sm hover:bg-accent hover:text-accent-foreground",
              accentPreset === "custom" && "border-primary",
            )}
            onClick={() => setAccentPreset("custom")}
          >
            <span
              className="size-5 rounded-full border border-black/10"
              style={{ backgroundColor: customAccent }}
            />
            {t("settings:customAccent")}
            {accentPreset === "custom" && <Check className="size-4" />}
          </button>
        </div>
      </SettingsField>

      {accentPreset === "custom" && (
        <SettingsField label={t("settings:customAccent")}>
          <Input
            type="color"
            value={customAccent}
            onChange={(event) => setCustomAccent(event.target.value)}
          />
        </SettingsField>
      )}

      <SettingsField label={t("settings:language")}>
        <Select
          value={language}
          onChange={(event) => setLanguage(event.target.value as Locale)}
        >
          {supportedLanguages.map((item) => (
            <option key={item} value={item}>
              {languageLabels[item]}
            </option>
          ))}
        </Select>
      </SettingsField>

      <div className="rounded-md border border-border bg-background p-4">
        <div className="mb-3 text-sm font-medium">{t("settings:preview")}</div>
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <div className="rounded-md border border-border bg-card p-3 text-sm">
            <div className="mb-2 h-2 w-16 rounded bg-primary" />
            <div className="space-y-1">
              <div className="h-2 rounded bg-muted" />
              <div className="h-2 w-2/3 rounded bg-muted" />
            </div>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">Mason Gallery</span>
              <Button type="button" size="sm">
                {accentLabels[accentPreset]}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="aspect-[3/4] rounded bg-muted" />
              <div className="aspect-square rounded bg-accent" />
              <div className="aspect-[4/5] rounded bg-muted" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setTheme("system");
            setThemePreset("mason");
            setAccentPreset("rose");
            setCustomAccent("#e75b73");
          }}
        >
          {t("settings:resetTheme")}
        </Button>
      </div>
    </SettingsSection>
  );
}
