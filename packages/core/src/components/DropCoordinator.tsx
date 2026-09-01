import { Archive, FolderOpen, UploadCloud } from "lucide-react";
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import {
  dedupeDroppedSources,
  libraryEffectForDropBehavior,
  planDroppedOpen,
  resolveDropDisposition,
  routeAcceptsExternalDrop,
} from "@/lib/dropPolicy";
import { applyLibraryEffect, openSources } from "@/lib/scanActions";
import { useAppStore } from "@/stores/appStore";
import { useDropStore } from "@/stores/dropStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";
import type {
  DropBatch,
  DropListener,
  DropPersistence,
  DroppedSource,
  LibraryEffect,
} from "@/types/platform";

function isDropBlockedByModal(blockCount: number): boolean {
  const app = useAppStore.getState();
  const viewer = useViewerStore.getState();
  return (
    blockCount > 0 ||
    viewer.isViewerOpen ||
    app.archivePasswordNeeded != null ||
    app.archiveMasterPasswordNeeded != null ||
    app.archiveSolidWarning != null ||
    app.archiveMigrationCandidate != null
  );
}

function summarizeDrop(
  t: ReturnType<typeof useI18n>,
  opened: number,
  skipped: number,
): string | null {
  if (skipped <= 0) return null;
  if (opened > 0) {
    return t("home:dropSummary", { opened, skipped });
  }
  return t("home:dropSummarySkippedOnly", { skipped });
}

export function DropCoordinator({
  children,
  galleryPath,
  targetRef,
  forceAccept = false,
  persistence,
  onPageDrop,
}: {
  children: ReactNode;
  galleryPath: string;
  targetRef?: RefObject<EventTarget | null>;
  forceAccept?: boolean;
  persistence?: DropPersistence;
  onPageDrop?: (batch: DropBatch) => void | Promise<void>;
}) {
  const t = useI18n();
  const platform = usePlatform();
  const [location, navigate] = useLocation();
  const exclusiveHandler = useDropStore((state) => state.exclusiveHandler);
  const blockCount = useDropStore((state) => state.blockCount);
  const isHovering = useDropStore((state) => state.isHovering);
  const pendingChoice = useDropStore((state) => state.pendingChoice);
  const setPendingChoice = useDropStore((state) => state.setPendingChoice);
  const externalDropBehavior = useSettingsStore(
    (state) => state.externalDropBehavior,
  );

  const locationRef = useRef(location);
  locationRef.current = location;
  const exclusiveRef = useRef(exclusiveHandler);
  exclusiveRef.current = exclusiveHandler;
  const blockCountRef = useRef(blockCount);
  blockCountRef.current = blockCount;
  const behaviorRef = useRef(externalDropBehavior);
  behaviorRef.current = externalDropBehavior;
  const galleryPathRef = useRef(galleryPath);
  galleryPathRef.current = galleryPath;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const tRef = useRef(t);
  tRef.current = t;
  const forceAcceptRef = useRef(forceAccept);
  forceAcceptRef.current = forceAccept;
  const persistenceRef = useRef(persistence);
  persistenceRef.current = persistence;
  const onPageDropRef = useRef(onPageDrop);
  onPageDropRef.current = onPageDrop;

  const currentDisposition = resolveDropDisposition({
    exclusive: exclusiveHandler != null,
    modalBlocked: isDropBlockedByModal(blockCount),
    routeAccepts: forceAccept || routeAcceptsExternalDrop(location),
  });

  const notifyRejected = useCallback((opened: number, skipped: number) => {
    const message = summarizeDrop(tRef.current, opened, skipped);
    if (message) {
      toast.add({ title: message, type: skipped > 0 ? "warning" : "success" });
    }
  }, []);

  const navigateToGallery = useCallback(() => {
    const current = locationRef.current.split("?")[0] ?? locationRef.current;
    if (current !== galleryPathRef.current) {
      navigateRef.current(galleryPathRef.current);
    }
  }, []);

  const openAccepted = useCallback(
    async (sources: DroppedSource[], skipped: number) => {
      navigateToGallery();
      await openSources(sources, { libraryEffect: "none" });
      notifyRejected(sources.length, skipped);
    },
    [navigateToGallery, notifyRejected],
  );

  const handlePageDrop = useCallback(
    async (batch: DropBatch) => {
      const unique = dedupeDroppedSources(batch.accepted);
      const skipped = batch.rejected.length;
      const effect: LibraryEffect = libraryEffectForDropBehavior(
        behaviorRef.current,
      );

      if (unique.length === 0) {
        notifyRejected(0, skipped);
        return;
      }

      if (effect !== "none") {
        await applyLibraryEffect(unique, effect);
      }

      const plan = planDroppedOpen(unique);
      if (plan.action === "choose") {
        useDropStore.getState().setPendingChoice({
          sources: unique,
          persistOthers: effect !== "none",
        });
        notifyRejected(0, skipped);
        return;
      }
      if (plan.action === "open") {
        await openAccepted(plan.sources, skipped);
      }
    },
    [notifyRejected, openAccepted],
  );

  useEffect(() => {
    if (!platform.capabilities.canDragDropFolders) return;

    const listener: DropListener = {
      accepts: () =>
        resolveDropDisposition({
          exclusive: exclusiveRef.current != null,
          modalBlocked: isDropBlockedByModal(blockCountRef.current),
          routeAccepts:
            forceAcceptRef.current ||
            routeAcceptsExternalDrop(locationRef.current),
        }) !== "ignore",
      persistence: () => {
        if (persistenceRef.current) return persistenceRef.current;
        if (exclusiveRef.current) return "durable";
        return behaviorRef.current === "open-only" ? "session" : "durable";
      },
      onOver: () => {
        if (
          resolveDropDisposition({
            exclusive: exclusiveRef.current != null,
            modalBlocked: isDropBlockedByModal(blockCountRef.current),
            routeAccepts:
              forceAcceptRef.current ||
              routeAcceptsExternalDrop(locationRef.current),
          }) === "page"
        ) {
          useDropStore.getState().setHovering(true);
        }
      },
      onDrop: (batch) => {
        useDropStore.getState().setHovering(false);
        const exclusive = exclusiveRef.current;
        const disposition = resolveDropDisposition({
          exclusive: exclusive != null,
          modalBlocked: isDropBlockedByModal(blockCountRef.current),
          routeAccepts:
            forceAcceptRef.current ||
            routeAcceptsExternalDrop(locationRef.current),
        });
        if (disposition === "exclusive" && exclusive) {
          exclusive(batch);
          return;
        }
        if (disposition === "page") {
          const custom = onPageDropRef.current;
          if (custom) {
            void custom(batch);
            return;
          }
          void handlePageDrop(batch);
        }
      },
      onCancel: () => {
        useDropStore.getState().setHovering(false);
      },
    };

    const target = targetRef?.current ?? undefined;
    if (targetRef && !target) return;

    return platform.onDragDrop(listener, { target });
  }, [handlePageDrop, platform, targetRef]);

  const overlayVisible = isHovering && currentDisposition === "page";

  return (
    <>
      {children}
      {overlayVisible && (
        <div
          className="pointer-events-none fixed inset-0 z-[9990] flex items-center justify-center bg-background/70"
          aria-hidden="true"
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-brand/50 bg-card/90 px-8 py-7 text-center shadow-lg">
            <UploadCloud className="size-10 text-brand" />
            <p className="text-lg font-semibold">{t("home:releaseToOpen")}</p>
          </div>
        </div>
      )}
      <Dialog
        open={pendingChoice != null}
        title={t("home:chooseDropTitle")}
        onClose={() => setPendingChoice(null)}
        className="sm:max-w-lg"
      >
        <p className="text-sm text-muted-foreground">
          {pendingChoice?.persistOthers
            ? t("home:chooseDropKeepOthers")
            : t("home:chooseDropSessionOthers")}
        </p>
        <ul className="max-h-72 divide-y divide-border overflow-auto rounded-xl border border-border">
          {pendingChoice?.sources.map((source) => (
            <li key={`${source.kind}:${source.locator}`}>
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start gap-3 rounded-none px-3 py-3"
                onClick={() => {
                  const selected = source;
                  setPendingChoice(null);
                  void openAccepted([selected], 0);
                }}
              >
                {source.kind === "archive" ? (
                  <Archive className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium">
                    {source.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {source.locator}
                  </span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
