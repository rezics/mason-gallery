import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import { SettingsField, SettingsSection } from "./SettingsField";

export function FilesSettingsSection() {
  const t = useI18n();
  const formats = useSettingsStore((s) => s.formats);
  const setFormats = useSettingsStore((s) => s.setFormats);
  const confirmDelete = useSettingsStore((s) => s.confirmDelete);
  const setConfirmDelete = useSettingsStore((s) => s.setConfirmDelete);
  const showDeleteToast = useSettingsStore((s) => s.showDeleteToast);
  const setShowDeleteToast = useSettingsStore((s) => s.setShowDeleteToast);
  const [formatsText, setFormatsText] = useState(formats.join(", "));

  useEffect(() => {
    setFormatsText(formats.join(", "));
  }, [formats]);

  const commitFormats = () => {
    const next = formatsText
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .map((value) => (value.startsWith(".") ? value : `.${value}`));
    if (next.length > 0) {
      const unique = [...new Set(next)];
      setFormats(unique);
      setFormatsText(unique.join(", "));
    }
  };

  return (
    <SettingsSection>
      <SettingsField
        label={t("settings:formats")}
        hint={t("settings:formatsHint")}
      >
        <Input
          value={formatsText}
          onChange={(event) => setFormatsText(event.target.value)}
          onBlur={commitFormats}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitFormats();
          }}
        />
      </SettingsField>
      <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
        <span>{t("settings:confirmDelete")}</span>
        <Switch
          aria-label={t("settings:confirmDelete")}
          checked={confirmDelete}
          onCheckedChange={setConfirmDelete}
        />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
        <span>{t("settings:showDeleteToast")}</span>
        <Switch
          aria-label={t("settings:showDeleteToast")}
          checked={showDeleteToast}
          onCheckedChange={setShowDeleteToast}
        />
      </div>
    </SettingsSection>
  );
}
