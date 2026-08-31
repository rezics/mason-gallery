import { languageLabels, supportedLanguages } from "@mason-gallery/i18n";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUpdateStore } from "@/stores/updateStore";
import type { Locale } from "@/types";
import { isUpdateBusy } from "@/updates/updateController";
import { SettingsField, SettingsSection } from "./SettingsField";

export function GeneralSettingsSection() {
  const t = useI18n();
  const platform = usePlatform();
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const autoCheckUpdates = useSettingsStore((state) => state.autoCheckUpdates);
  const setAutoCheckUpdates = useSettingsStore(
    (state) => state.setAutoCheckUpdates,
  );
  const updateStatus = useUpdateStore((state) => state.status);
  const checkForUpdates = useUpdateStore((state) => state.check);
  const showUpdates = platform.capabilities.canAutoUpdate;
  const checking = isUpdateBusy(updateStatus);

  return (
    <>
      <SettingsSection>
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

      {showUpdates && (
        <SettingsSection>
          <SettingsField label={t("settings:updates")}>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={checking}
              aria-label={t("settings:checkForUpdates")}
              onClick={() => {
                void checkForUpdates("manual");
              }}
            >
              {updateStatus === "checking" && (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              )}
              {updateStatus === "checking"
                ? t("update:checking")
                : t("settings:checkForUpdates")}
            </Button>
          </SettingsField>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
            <span>{t("settings:autoCheckUpdates")}</span>
            <Switch
              aria-label={t("settings:autoCheckUpdates")}
              checked={autoCheckUpdates}
              onCheckedChange={setAutoCheckUpdates}
            />
          </div>
        </SettingsSection>
      )}
    </>
  );
}
