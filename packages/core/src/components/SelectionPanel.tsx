import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useI18n } from "@/i18n";
import { entryDisplayName, knownPackageRoots } from "@/lib/selectionActions";
import { useSelectionStore } from "@/stores/selectionStore";
import type {
  PersistedSelectionEntry,
  SelectableFileProbe,
} from "@/types/platform";

function groupByPackage(
  entries: PersistedSelectionEntry[],
  roots: Array<{ path: string; packageKey: string }>,
): Array<{
  packageKey: string;
  label: string;
  entries: PersistedSelectionEntry[];
}> {
  const labelByKey = new Map(roots.map((root) => [root.packageKey, root.path]));
  const groups = new Map<string, PersistedSelectionEntry[]>();
  for (const entry of entries) {
    const list = groups.get(entry.packageKey) ?? [];
    list.push(entry);
    groups.set(entry.packageKey, list);
  }
  return [...groups.entries()]
    .map(([packageKey, grouped]) => ({
      packageKey,
      label: labelByKey.get(packageKey) ?? packageKey,
      entries: grouped.sort((a, b) =>
        a.relativePath.localeCompare(b.relativePath),
      ),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export default function SelectionPanel({
  open,
  onOpenChange,
  probes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  probes: SelectableFileProbe[];
}) {
  const t = useI18n();
  const entries = useSelectionStore((state) => state.entries);
  const selected = useMemo(() => [...entries.values()], [entries]);
  const roots = knownPackageRoots();
  const availableLocators = useMemo(
    () =>
      new Set(
        probes.filter((probe) => probe.available).map((probe) => probe.locator),
      ),
    [probes],
  );
  const groups = useMemo(
    () => groupByPackage(selected, roots),
    [selected, roots],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[420px] max-w-[calc(100vw-1.5rem)] flex-col pt-9">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>{t("selection:selectedPanelTitle")}</SheetTitle>
          <SheetDescription>
            {t("selection:selectedCount", { count: selected.length })}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-auto p-5">
          {selected.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("selection:selectedPanelEmpty")}
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {groups.map((group) => (
                <section key={group.packageKey} className="flex flex-col gap-2">
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {roots.some((root) => root.packageKey === group.packageKey)
                      ? group.label
                      : t("selection:outsideGalleries")}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {group.entries.map((entry) => {
                      const available =
                        probes.length === 0
                          ? true
                          : availableLocators.has(entry.locator);
                      return (
                        <li
                          key={`${entry.packageKey}:${entry.entryKey}`}
                          className="rounded-xl border border-border bg-card px-3 py-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {entryDisplayName(entry)}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {entry.locator}
                              </p>
                            </div>
                            <Badge
                              variant={available ? "secondary" : "destructive"}
                            >
                              {available
                                ? t("selection:available")
                                : t("selection:unavailable")}
                            </Badge>
                          </div>
                          {!available && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t("selection:unavailableHint")}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
