import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import type {
  CacheCleanupStrategy,
  PasswordStorageMode,
} from "@/types/platform";
import { SettingsField, SettingsSection } from "./SettingsField";

export function ArchiveSettingsSection({
  onManageCache,
}: {
  onManageCache: () => void;
}) {
  const t = useI18n();
  const cacheCleanupStrategy = useSettingsStore((s) => s.cacheCleanupStrategy);
  const setCacheCleanupStrategy = useSettingsStore(
    (s) => s.setCacheCleanupStrategy,
  );
  const passwordStorageMode = useSettingsStore((s) => s.passwordStorageMode);
  const setPasswordStorageMode = useSettingsStore(
    (s) => s.setPasswordStorageMode,
  );

  return (
    <SettingsSection>
      <SettingsField label={t.archive.cacheCleanup}>
        <Select
          value={cacheCleanupStrategy}
          onChange={(event) =>
            setCacheCleanupStrategy(event.target.value as CacheCleanupStrategy)
          }
        >
          <option value="auto-clean">{t.archive.autoClean}</option>
          <option value="keep-all">{t.archive.keepAll}</option>
        </Select>
      </SettingsField>
      <SettingsField label={t.archive.passwordStorage}>
        <Select
          value={passwordStorageMode}
          onChange={(event) =>
            setPasswordStorageMode(event.target.value as PasswordStorageMode)
          }
        >
          <option value="none">{t.archive.dontSave}</option>
          <option value="plaintext">{t.archive.plaintext}</option>
          <option value="master">{t.archive.masterPassword}</option>
        </Select>
      </SettingsField>
      <Button type="button" variant="outline" onClick={onManageCache}>
        {t.archive.manageCache}
      </Button>
    </SettingsSection>
  );
}
