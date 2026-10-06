import { Autocomplete } from "@base-ui/react/autocomplete";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import type { PlatformCapabilities } from "@/types/platform";
import {
  buildSettingsSearchEntries,
  createSettingsSearch,
  type SettingSearchEntry,
} from "./settingDefinitions";
import type { SettingsCategory } from "./settingsRoutes";

export function SettingsSearch({
  categories,
  onSelect,
}: {
  categories: readonly SettingsCategory[];
  onSelect: (entry: SettingSearchEntry) => void;
}) {
  const t = useI18n();
  const language = useSettingsStore((state) => state.language);
  const { capabilities } = usePlatform();
  const [query, setQuery] = useState("");
  const categoryKey = categories.join(",");
  const capabilityKey = JSON.stringify(capabilities);
  const search = useMemo(
    () =>
      createSettingsSearch(
        buildSettingsSearchEntries(
          (key) => t(key, { lng: language }),
          JSON.parse(capabilityKey) as PlatformCapabilities,
          categoryKey.split(",") as SettingsCategory[],
        ),
      ),
    [t, language, capabilityKey, categoryKey],
  );
  const results = search(query);
  return (
    <Autocomplete.Root
      items={results}
      value={query}
      onValueChange={setQuery}
      mode="none"
      autoHighlight
      itemToStringValue={(item: SettingSearchEntry) => item.label}
    >
      <Autocomplete.Input
        render={<Input />}
        aria-label={t("settings:searchSettings")}
        placeholder={t("settings:searchSettings")}
      />
      <Autocomplete.Portal>
        <Autocomplete.Positioner
          sideOffset={6}
          className="z-[10001] w-[min(32rem,calc(100vw-2rem))]"
        >
          <Autocomplete.Popup className="max-h-80 overflow-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg">
            <Autocomplete.Empty className="p-3 text-sm text-muted-foreground">
              {t("settings:noSearchResults")}
            </Autocomplete.Empty>
            <Autocomplete.List>
              {(entry: SettingSearchEntry) => (
                <Autocomplete.Item
                  key={entry.id}
                  value={entry}
                  className="flex cursor-pointer flex-col gap-1 rounded-lg p-3 text-sm outline-none data-highlighted:bg-accent"
                  onClick={() => {
                    setQuery("");
                    onSelect(entry);
                  }}
                >
                  <span className="font-medium">
                    {entry.label}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {entry.categoryLabel}
                    </span>
                  </span>
                  {entry.description && (
                    <span className="text-xs text-muted-foreground">
                      {entry.description}
                    </span>
                  )}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}

export function useSettingFocus(
  target: { anchor: string; category: string; fallbackAnchor?: string } | null,
) {
  useEffect(() => {
    if (!target) return;
    let done = false;
    let frame = 0;
    const focus = () => {
      if (done) return;
      const element =
        document.getElementById(target.anchor) ??
        (target.fallbackAnchor
          ? document.getElementById(target.fallbackAnchor)
          : null);
      if (!element) return;
      done = true;
      frame = requestAnimationFrame(() => {
        element.scrollIntoView({ block: "center", behavior: "smooth" });
        const control = element.matches("input,button,select,[role='switch']")
          ? element
          : element.querySelector<HTMLElement>(
              "input,button,select,[role='switch']",
            );
        let focusTarget = control ?? element;
        if (focusTarget.matches(":disabled, [aria-disabled='true']"))
          focusTarget = element.parentElement ?? element;
        if (!focusTarget.matches("input,button,select,[tabindex]"))
          focusTarget.tabIndex = -1;
        focusTarget.focus({ preventScroll: true });
      });
    };
    const observer = new MutationObserver(focus);
    observer.observe(document.body, { childList: true, subtree: true });
    focus();
    const timeout = setTimeout(() => observer.disconnect(), 3000);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [target]);
}
