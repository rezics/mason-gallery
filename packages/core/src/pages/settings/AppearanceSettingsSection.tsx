import { languageLabels, supportedLanguages } from "@mason-gallery/i18n";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Locale } from "@/types";
import type { ThemePreference } from "@/types/platform";
import { SettingsField, SettingsSection } from "./SettingsField";

export function AppearanceSettingsSection() {
  const t = useI18n();
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  return (
    <SettingsSection>
      <SettingsField label={t("settings:themeMode")}>
        <NativeSelect
          className="w-full"
          value={theme}
          onChange={(event) => setTheme(event.target.value as ThemePreference)}
        >
          <NativeSelectOption value="system">
            {t("settings:modeSystem")}
          </NativeSelectOption>
          <NativeSelectOption value="light">
            {t("settings:modeLight")}
          </NativeSelectOption>
          <NativeSelectOption value="dark">
            {t("settings:modeDark")}
          </NativeSelectOption>
        </NativeSelect>
      </SettingsField>

      <SettingsField label={t("settings:language")}>
        <NativeSelect
          className="w-full"
          value={language}
          onChange={(event) => setLanguage(event.target.value as Locale)}
        >
          {supportedLanguages.map((item) => (
            <NativeSelectOption key={item} value={item}>
              {languageLabels[item]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </SettingsField>
    </SettingsSection>
  );
}
