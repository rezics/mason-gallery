import { Columns3, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
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
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import {
  getActiveBreakpoint,
  resolveBreakpointWidth,
} from "@/lib/columnBreakpoints";
import { shouldShowMultiselectEntry } from "@/lib/selectionContract";
import { useAppStore } from "@/stores/appStore";
import { useSelectionStore } from "@/stores/selectionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";
import type { SortMethod } from "@/types";

function useViewportWidth(enabled: boolean) {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    if (!enabled) return;
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [enabled]);
  return width;
}

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
  const galleryLayoutWidth = useAppStore((state) => state.galleryLayoutWidth);
  const viewportWidth = useViewportWidth(isOpen && galleryLayoutWidth == null);
  const layoutWidth = resolveBreakpointWidth({
    galleryWidth: galleryLayoutWidth,
    viewportWidth,
  });
  const activeBreakpoint = getActiveBreakpoint(layoutWidth, breakpoints);
  const platform = usePlatform();
  const images = useViewerStore((state) => state.images);
  const modeEnabled = useSelectionStore((state) => state.modeEnabled);
  const setModeEnabled = useSelectionStore((state) => state.setModeEnabled);
  const showMultiselect = shouldShowMultiselectEntry(platform, images);

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

          {showMultiselect && (
            <Field>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor="quick-multiselect">
                  {t("selection:multiselectMode")}
                </FieldLabel>
                <Switch
                  id="quick-multiselect"
                  checked={modeEnabled}
                  onCheckedChange={setModeEnabled}
                />
              </div>
              <FieldDescription>
                {t("selection:multiselectModeHint")}
              </FieldDescription>
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="quick-columns">
              {t("settings:columns")}
            </FieldLabel>
            <FieldDescription>{activeBreakpoint.minWidth}px</FieldDescription>
            <Input
              id="quick-columns"
              type="number"
              min={1}
              max={10}
              value={activeBreakpoint.columns}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (value >= 1 && value <= 10) {
                  setBreakpoints({
                    ...breakpoints,
                    [activeBreakpoint.minWidth]: value,
                  });
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
            onClick={() => openSettingsRoute("/settings/general")}
          >
            <Settings data-icon="inline-start" />
            {t("settings:preferences")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => openSettingsRoute("/settings/general")}
          >
            {t("settings:language")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
