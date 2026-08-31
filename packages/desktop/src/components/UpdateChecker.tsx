import { Button, toast, useI18n, useUpdateStore } from "@mason-gallery/core";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

export default function UpdateChecker() {
  const t = useI18n();
  const status = useUpdateStore((state) => state.status);
  const version = useUpdateStore((state) => state.version);
  const errorPhase = useUpdateStore((state) => state.errorPhase);
  const lastCheckReason = useUpdateStore((state) => state.lastCheckReason);
  const bannerVisible = useUpdateStore((state) => state.bannerVisible);
  const check = useUpdateStore((state) => state.check);
  const install = useUpdateStore((state) => state.install);
  const dismiss = useUpdateStore((state) => state.dismiss);
  const notifiedKeyRef = useRef("");

  useEffect(() => {
    void check("auto");
  }, [check]);

  useEffect(() => {
    const key = `${status}:${lastCheckReason}:${errorPhase ?? ""}`;
    if (key === notifiedKeyRef.current) return;
    if (status === "idle" || status === "checking" || status === "installing") {
      return;
    }
    notifiedKeyRef.current = key;

    if (status === "up-to-date" && lastCheckReason === "manual") {
      toast.add({ title: t("update:upToDate"), type: "success" });
    }

    if (
      status === "error" &&
      (lastCheckReason === "manual" || errorPhase === "install")
    ) {
      toast.add({
        title:
          errorPhase === "install"
            ? t("update:installFailed")
            : t("update:checkFailed"),
        type: "error",
      });
    }
  }, [errorPhase, lastCheckReason, status, t]);

  if (status === "installing") {
    return (
      <div className="fixed bottom-4 left-1/2 z-[10000] -translate-x-1/2 rounded-md border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg">
        <div className="flex items-center gap-3">
          <span>{t("update:installing")}</span>
          <Loader2 className="size-4 animate-spin" />
        </div>
      </div>
    );
  }

  if (status !== "available" || !bannerVisible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[10000] -translate-x-1/2 rounded-md border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg">
      <div className="flex items-center gap-3">
        <span>{t("update:available", { version: version ?? "" })}</span>
        <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
          {t("update:dismiss")}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            void install();
          }}
        >
          {t("update:install")}
        </Button>
      </div>
    </div>
  );
}
