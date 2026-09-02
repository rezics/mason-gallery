import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "@/components/ui/toast";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { dedupeDroppedSources, planDroppedOpen } from "@/lib/dropPolicy";
import { applyLibraryEffect, openSources } from "@/lib/scanActions";
import { useDropStore } from "@/stores/dropStore";
import type { DropBatch } from "@/types/platform";

export function ExternalOpenCoordinator({
  galleryPath,
}: {
  galleryPath: string;
}) {
  const t = useI18n();
  const platform = usePlatform();
  const [location, navigate] = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const tRef = useRef(t);
  tRef.current = t;

  const navigateToGallery = useCallback(() => {
    const current = locationRef.current.split("?")[0] ?? locationRef.current;
    if (current !== galleryPath) {
      navigateRef.current(galleryPath);
    }
  }, [galleryPath]);

  const handleBatch = useCallback(
    async (batch: DropBatch) => {
      const sources = dedupeDroppedSources(batch.accepted);
      const skipped = batch.rejected.length;
      if (sources.length === 0) {
        if (skipped > 0) {
          toast.add({
            title: tRef.current("home:dropSummarySkippedOnly", { skipped }),
            type: "warning",
          });
        }
        return;
      }

      await applyLibraryEffect(sources, "ensure");
      const plan = planDroppedOpen(sources);
      if (plan.action === "choose") {
        useDropStore.getState().setPendingChoice({
          sources,
          persistOthers: true,
        });
      } else if (plan.action === "open") {
        navigateToGallery();
        await openSources(plan.sources, { libraryEffect: "none" });
      }

      if (skipped > 0) {
        toast.add({
          title: tRef.current("home:dropSummary", {
            opened: plan.action === "open" ? plan.sources.length : 0,
            skipped,
          }),
          type: "warning",
        });
      }
    },
    [navigateToGallery],
  );

  useEffect(() => {
    if (!platform.onOpenSources) return;
    return platform.onOpenSources((batch) => {
      void handleBatch(batch);
    });
  }, [handleBatch, platform]);

  return null;
}
