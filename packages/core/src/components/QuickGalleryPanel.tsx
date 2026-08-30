import { Columns3, Settings } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { SortMethod } from "@/types";

export default function QuickGalleryPanel() {
  const t = useI18n();
  const [, navigate] = useLocation();
  const isOpen = useAppStore((state) => state.isQuickPanelOpen);
  const setOpen = useAppStore((state) => state.setQuickPanelOpen);
  const sortMethod = useSettingsStore((state) => state.sortMethod);
  const setSortMethod = useSettingsStore((state) => state.setSortMethod);
  const pageSize = useSettingsStore((state) => state.pageSize);
  const setPageSize = useSettingsStore((state) => state.setPageSize);
  const showGridPosition = useSettingsStore((state) => state.showGridPosition);
  const setShowGridPosition = useSettingsStore(
    (state) => state.setShowGridPosition,
  );
  const breakpoints = useSettingsStore((state) => state.breakpoints);
  const setBreakpoints = useSettingsStore((state) => state.setBreakpoints);
  const columnsAtDesktop = breakpoints[1200] ?? 4;

  const openSettingsRoute = (route: string) => {
    setOpen(false);
    navigate(route);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent className="w-[340px] max-w-[calc(100vw-1.5rem)] pt-9">
        <SheetHeader className="border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Columns3 className="size-4 text-brand" />
            <SheetTitle>{t("actions:quickControls")}</SheetTitle>
          </div>
          <SheetDescription className="sr-only">
            {t("actions:preferences")}
          </SheetDescription>
        </SheetHeader>

        <FieldGroup className="flex-1 overflow-auto p-5">
          <Field>
            <FieldLabel htmlFor="quick-sort-method">
              {t("settings:sortMethod")}
            </FieldLabel>
            <NativeSelect
              id="quick-sort-method"
              className="w-full"
              value={sortMethod}
              onChange={(event) =>
                setSortMethod(event.target.value as SortMethod)
              }
            >
              <option value="name-asc">{t("settings:nameAsc")}</option>
              <option value="name-desc">{t("settings:nameDesc")}</option>
              <option value="time-asc">{t("settings:timeAsc")}</option>
              <option value="time-desc">{t("settings:timeDesc")}</option>
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="quick-page-size">
              {t("settings:pageSize")}
            </FieldLabel>
            <Input
              id="quick-page-size"
              type="number"
              min={10}
              max={200}
              step={10}
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
            />
          </Field>

          <Field orientation="horizontal" className="justify-between">
            <FieldLabel htmlFor="quick-grid-position">
              {t("settings:showGridPosition")}
            </FieldLabel>
            <Switch
              id="quick-grid-position"
              checked={showGridPosition}
              onCheckedChange={setShowGridPosition}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="quick-columns">
              {t("settings:columns")}
            </FieldLabel>
            <Input
              id="quick-columns"
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
          </Field>
        </FieldGroup>

        <SheetFooter className="border-t p-5">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => openSettingsRoute("/settings/gallery")}
          >
            <Settings data-icon="inline-start" />
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
