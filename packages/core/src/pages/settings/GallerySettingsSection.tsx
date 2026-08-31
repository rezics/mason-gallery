import { Input } from "@/components/ui/input";
import { NativeSelect as Select } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import type { SortMethod } from "@/types";
import type { ExternalDropBehavior } from "@/types/platform";
import { SettingsField, SettingsSection } from "./SettingsField";

export function GallerySettingsSection() {
  const t = useI18n();
  const platform = usePlatform();
  const sortMethod = useSettingsStore((s) => s.sortMethod);
  const setSortMethod = useSettingsStore((s) => s.setSortMethod);
  const pageSize = useSettingsStore((s) => s.pageSize);
  const setPageSize = useSettingsStore((s) => s.setPageSize);
  const breakpoints = useSettingsStore((s) => s.breakpoints);
  const setBreakpoints = useSettingsStore((s) => s.setBreakpoints);
  const showGridPosition = useSettingsStore((s) => s.showGridPosition);
  const setShowGridPosition = useSettingsStore((s) => s.setShowGridPosition);
  const openGallerySidebarByDefault = useSettingsStore(
    (s) => s.openGallerySidebarByDefault,
  );
  const setOpenGallerySidebarByDefault = useSettingsStore(
    (s) => s.setOpenGallerySidebarByDefault,
  );
  const externalDropBehavior = useSettingsStore((s) => s.externalDropBehavior);
  const setExternalDropBehavior = useSettingsStore(
    (s) => s.setExternalDropBehavior,
  );

  return (
    <SettingsSection>
      {platform.capabilities.canDragDropFolders && (
        <SettingsField label={t("settings:externalDropBehavior")}>
          <Select
            value={externalDropBehavior}
            onChange={(event) =>
              setExternalDropBehavior(
                event.target.value as ExternalDropBehavior,
              )
            }
          >
            <option value="add-and-open">
              {t("settings:externalDropAddAndOpen")}
            </option>
            <option value="open-only">
              {t("settings:externalDropOpenOnly")}
            </option>
          </Select>
        </SettingsField>
      )}
      <SettingsField label={t("settings:sortMethod")}>
        <Select
          value={sortMethod}
          onChange={(event) => setSortMethod(event.target.value as SortMethod)}
        >
          <option value="name-asc">{t("settings:nameAsc")}</option>
          <option value="name-desc">{t("settings:nameDesc")}</option>
          <option value="time-asc">{t("settings:timeAsc")}</option>
          <option value="time-desc">{t("settings:timeDesc")}</option>
        </Select>
      </SettingsField>
      <SettingsField label={t("settings:pageSize")}>
        <Input
          type="number"
          min={10}
          max={200}
          step={10}
          value={pageSize}
          onChange={(event) => setPageSize(Number(event.target.value))}
        />
      </SettingsField>
      <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
        <span>{t("settings:showGridPosition")}</span>
        <Switch
          aria-label={t("settings:showGridPosition")}
          checked={showGridPosition}
          onCheckedChange={setShowGridPosition}
        />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
        <span>{t("settings:openGallerySidebarByDefault")}</span>
        <Switch
          aria-label={t("settings:openGallerySidebarByDefault")}
          checked={openGallerySidebarByDefault}
          onCheckedChange={setOpenGallerySidebarByDefault}
        />
      </div>
      <SettingsField label={t("settings:columns")}>
        <div className="grid gap-2">
          {Object.keys(breakpoints)
            .map(Number)
            .sort((a, b) => a - b)
            .map((breakpoint) => (
              <div
                key={breakpoint}
                className="grid grid-cols-[1fr_88px] items-center gap-3"
              >
                <span className="text-sm text-muted-foreground">
                  {breakpoint}px
                </span>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={breakpoints[breakpoint]}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (value >= 1 && value <= 10) {
                      setBreakpoints({
                        ...breakpoints,
                        [breakpoint]: value,
                      });
                    }
                  }}
                />
              </div>
            ))}
        </div>
      </SettingsField>
    </SettingsSection>
  );
}
