import { Check, FolderInput, ListChecks, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import SelectionPanel from "@/components/SelectionPanel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/toast";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import {
  applySuccessfulMoveToSelection,
  availableSelectedEntries,
  coordinateGridAfterMove,
  currentPackageKeys,
  entryDisplayName,
  selectedEntries,
} from "@/lib/selectionActions";
import { shouldShowSelectionChrome } from "@/lib/selectionContract";
import { useSelectionStore } from "@/stores/selectionStore";
import type {
  MoveConflictPolicy,
  MoveItemResult,
  MoveProgress,
  SelectableFileProbe,
} from "@/types/platform";

function resultMessage(
  t: ReturnType<typeof useI18n>,
  result: MoveItemResult,
): string {
  if (result.status === "moved") return t("selection:moveStatusMoved");
  if (result.status === "copied-not-removed") {
    return t("selection:copiedNotRemovedHint");
  }
  if (result.status === "skipped") {
    if (result.reason === "conflict") return t("selection:skipReasonConflict");
    if (result.reason === "same-location") {
      return t("selection:skipReasonSameLocation");
    }
    return t("selection:skipReasonCancelled");
  }
  switch (result.code) {
    case "missing":
      return t("selection:failMissing");
    case "permission-denied":
      return t("selection:failPermission");
    case "invalid-source":
      return t("selection:failInvalidSource");
    case "invalid-destination":
      return t("selection:failInvalidDestination");
    default:
      return t("selection:failIo");
  }
}

export default function SelectionActionBar({
  visibleCount,
}: {
  visibleCount: number;
}) {
  const t = useI18n();
  const platform = usePlatform();
  const modeEnabled = useSelectionStore((state) => state.modeEnabled);
  const selectedCount = useSelectionStore((state) => state.entries.size);
  const clearPackage = useSelectionStore((state) => state.clearPackage);
  const clearAll = useSelectionStore((state) => state.clearAll);
  const [panelOpen, setPanelOpen] = useState(false);
  const [probes, setProbes] = useState<SelectableFileProbe[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  const [conflictPolicy, setConflictPolicy] =
    useState<MoveConflictPolicy>("keep-both");
  const [moving, setMoving] = useState(false);
  const [progress, setProgress] = useState<MoveProgress | null>(null);
  const [results, setResults] = useState<MoveItemResult[] | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [movableCount, setMovableCount] = useState(0);
  const [unavailableCount, setUnavailableCount] = useState(0);

  const visible = shouldShowSelectionChrome(
    platform,
    modeEnabled,
    selectedCount,
  );

  const refreshProbes = useCallback(async () => {
    const entries = selectedEntries();
    if (!platform.probeSelectableFiles || entries.length === 0) {
      setProbes([]);
      return [];
    }
    const next = await platform.probeSelectableFiles(
      entries.map((entry) => entry.locator),
    );
    setProbes(next);
    return next;
  }, [platform]);

  const openPanel = useCallback(async () => {
    await refreshProbes();
    setPanelOpen(true);
  }, [refreshProbes]);

  const startMove = useCallback(async () => {
    if (!platform.pickMoveDestination || !platform.probeSelectableFiles) return;
    const picked = await platform.pickMoveDestination();
    if (!picked) return;
    const nextProbes = await refreshProbes();
    const entries = selectedEntries();
    const movable = availableSelectedEntries(entries, nextProbes);
    setDestination(picked);
    setMovableCount(movable.length);
    setUnavailableCount(entries.length - movable.length);
    setConflictPolicy("keep-both");
    setResults(null);
    setProgress(null);
    if (movable.length === 0) {
      toast.add({ title: t("selection:nothingToMove"), type: "warning" });
      return;
    }
    setConfirmOpen(true);
  }, [platform, refreshProbes, t]);

  const executeMove = useCallback(async () => {
    if (!destination || !platform.moveFiles) return;
    const nextProbes = probes.length > 0 ? probes : await refreshProbes();
    const movable = availableSelectedEntries(selectedEntries(), nextProbes);
    if (movable.length === 0) {
      setConfirmOpen(false);
      toast.add({ title: t("selection:nothingToMove"), type: "warning" });
      return;
    }
    const id =
      globalThis.crypto?.randomUUID?.() ??
      `move-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setOperationId(id);
    setMoving(true);
    setConfirmOpen(false);
    setProgress({
      operationId: id,
      completed: 0,
      total: movable.length,
      succeeded: 0,
      skipped: 0,
      failed: 0,
    });
    try {
      const nextResults = await platform.moveFiles(
        {
          operationId: id,
          destinationDirectory: destination,
          conflictPolicy,
          items: movable.map((entry) => ({
            entryKey: entry.entryKey,
            sourcePath: entry.locator,
          })),
        },
        (next) => setProgress(next),
      );
      setResults(nextResults);
      applySuccessfulMoveToSelection(nextResults);
      coordinateGridAfterMove(nextResults);
    } catch (error) {
      console.error("Batch move failed:", error);
      toast.add({ title: t("selection:failIo"), type: "error" });
      setMoving(false);
      setOperationId(null);
    }
  }, [conflictPolicy, destination, platform, probes, refreshProbes, t]);

  const stopMove = useCallback(async () => {
    if (!operationId || !platform.cancelMoveFiles) return;
    await platform.cancelMoveFiles(operationId);
  }, [operationId, platform]);

  const closeResults = useCallback(() => {
    setMoving(false);
    setResults(null);
    setProgress(null);
    setOperationId(null);
    setDestination(null);
  }, []);

  const counts = useMemo(() => {
    if (!results) return null;
    let moved = 0;
    let skipped = 0;
    let failed = 0;
    for (const result of results) {
      if (result.status === "moved") moved += 1;
      else if (result.status === "skipped") skipped += 1;
      else failed += 1;
    }
    return { moved, skipped, failed };
  }, [results]);

  if (!visible) return null;

  const progressValue =
    progress && progress.total > 0
      ? (progress.completed / progress.total) * 100
      : undefined;

  return (
    <>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {t("selection:statusVisibleAndSelected", {
            visible: visibleCount,
            selected: selectedCount,
          })}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void startMove()}
          disabled={selectedCount === 0 || moving}
        >
          <FolderInput data-icon="inline-start" />
          {t("selection:moveTo")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void openPanel()}
        >
          <ListChecks data-icon="inline-start" />
          {t("selection:viewSelected")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={selectedCount === 0}
              />
            }
          >
            <Trash2 data-icon="inline-start" />
            {t("selection:clear")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                for (const packageKey of currentPackageKeys()) {
                  clearPackage(packageKey);
                }
              }}
            >
              {t("selection:clearCurrentGallery")}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => clearAll()}>
              {t("selection:clearAllGalleries")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SelectionPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        probes={probes}
      />

      <Dialog
        open={confirmOpen}
        title={t("selection:moveConfirmTitle")}
        onClose={() => setConfirmOpen(false)}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              {t("selection:cancel")}
            </Button>
            <Button type="button" onClick={() => void executeMove()}>
              {t("selection:confirmMove")}
            </Button>
          </>
        }
      >
        <p>
          {t("selection:moveConfirmSummary", {
            movable: movableCount,
            unavailable: unavailableCount,
          })}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("selection:moveDestination")}: {destination}
        </p>
        <Field>
          <FieldLabel htmlFor="move-conflict-policy">
            {t("selection:conflictPolicy")}
          </FieldLabel>
          <NativeSelect
            id="move-conflict-policy"
            className="w-full"
            value={conflictPolicy}
            onChange={(event) =>
              setConflictPolicy(event.target.value as MoveConflictPolicy)
            }
          >
            <option value="keep-both">{t("selection:keepBoth")}</option>
            <option value="skip">{t("selection:skipConflicts")}</option>
          </NativeSelect>
          <FieldDescription>
            {conflictPolicy === "keep-both"
              ? t("selection:keepBothHint")
              : t("selection:skipConflictsHint")}
          </FieldDescription>
        </Field>
      </Dialog>

      <Dialog
        open={moving}
        title={
          results
            ? t("selection:moveResultsTitle")
            : t("selection:moveConfirmTitle")
        }
        onClose={results ? closeResults : undefined}
        className="sm:max-w-lg"
        actions={
          results ? (
            <Button type="button" onClick={closeResults}>
              {t("selection:done")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => void stopMove()}
            >
              {t("selection:stop")}
            </Button>
          )
        }
      >
        {!results && (
          <>
            <Progress value={progressValue ?? null} />
            <p className="text-sm text-muted-foreground">
              {t("selection:moveProgress", {
                completed: progress?.completed ?? 0,
                total: progress?.total ?? 0,
              })}
            </p>
          </>
        )}
        {results && counts && (
          <div className="flex max-h-80 flex-col gap-3 overflow-auto">
            <p>
              {t("selection:moveCounts", {
                moved: counts.moved,
                skipped: counts.skipped,
                failed: counts.failed,
              })}
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              {results.map((result) => (
                <li
                  key={`${result.status}:${result.entryKey}`}
                  className="rounded-lg border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-2 font-medium">
                    {result.status === "moved" && (
                      <Check className="size-3.5" />
                    )}
                    <span className="truncate">
                      {entryDisplayName({
                        relativePath: result.sourcePath,
                        locator: result.sourcePath,
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {resultMessage(t, result)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Dialog>
    </>
  );
}
