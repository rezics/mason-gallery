import { Columns3, Settings, X } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input, Select, Switch } from "@/components/ui/field";
import { useI18n } from "@/i18n";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { SortMethod } from "@/types";

export default function QuickGalleryPanel() {
  const t = useI18n();
  const [, navigate] = useLocation();
  const isOpen = useAppStore((s) => s.isQuickPanelOpen);
  const setOpen = useAppStore((s) => s.setQuickPanelOpen);
  const sortMethod = useSettingsStore((s) => s.sortMethod);
  const setSortMethod = useSettingsStore((s) => s.setSortMethod);
  const pageSize = useSettingsStore((s) => s.pageSize);
  const setPageSize = useSettingsStore((s) => s.setPageSize);
  const showGridPosition = useSettingsStore((s) => s.showGridPosition);
  const setShowGridPosition = useSettingsStore((s) => s.setShowGridPosition);
  const breakpoints = useSettingsStore((s) => s.breakpoints);
  const setBreakpoints = useSettingsStore((s) => s.setBreakpoints);

  const columnsAtDesktop = breakpoints[1200] ?? 4;

  const openSettingsRoute = (route: string) => {
    setOpen(false);
    navigate(route);
  };

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label={t("actions:close")}
          className="fixed inset-0 z-40 cursor-default bg-black/25"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed right-0 top-0 z-50 h-screen w-[340px] max-w-[calc(100vw-24px)] border-l border-border bg-popover pt-11 text-popover-foreground shadow-xl transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!isOpen}
      >
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Columns3 className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">
                {t("actions:quickControls")}
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("actions:close")}
              onClick={() => setOpen(false)}
            >
              <X />
            </Button>
          </header>

          <div className="flex-1 space-y-5 overflow-auto p-4">
            <section className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                {t("settings:sortMethod")}
              </div>
              <Select
                value={sortMethod}
                onChange={(event) =>
                  setSortMethod(event.target.value as SortMethod)
                }
              >
                <option value="name-asc">{t("settings:nameAsc")}</option>
                <option value="name-desc">{t("settings:nameDesc")}</option>
                <option value="time-asc">{t("settings:timeAsc")}</option>
                <option value="time-desc">{t("settings:timeDesc")}</option>
              </Select>
            </section>

            <section className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                {t("settings:pageSize")}
              </div>
              <Input
                type="number"
                min={10}
                max={200}
                step={10}
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
              />
            </section>

            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
              <span>{t("settings:showGridPosition")}</span>
              <Switch
                checked={showGridPosition}
                onChange={(event) =>
                  setShowGridPosition(event.currentTarget.checked)
                }
              />
            </div>

            <section className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                {t("settings:columns")}
              </div>
              <Input
                type="number"
                min={1}
                max={10}
                value={columnsAtDesktop}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (value >= 1 && value <= 10) {
                    setBreakpoints({ ...breakpoints, 1200: value });
                  }
                }}
              />
            </section>
          </div>

          <footer className="space-y-2 border-t border-border p-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => openSettingsRoute("/settings/gallery")}
            >
              <Settings />
              {t("settings:preferences")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => openSettingsRoute("/settings/appearance")}
            >
              {t("settings:language")}
            </Button>
          </footer>
        </div>
      </aside>
    </>
  );
}
