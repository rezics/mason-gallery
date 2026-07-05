import { Button, useI18n } from "@mason-gallery/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export default function UpdateChecker() {
  const t = useI18n();
  const [update, setUpdate] = useState<Update | null>(null);
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    check()
      .then((u) => {
        if (u) {
          setUpdate(u);
          setOpen(true);
        }
      })
      .catch((e) => {
        console.error("Update check failed:", e);
      });
  }, []);

  const handleInstall = useCallback(async () => {
    if (!update) return;
    setInstalling(true);
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (e) {
      console.error("Update install failed:", e);
      setInstalling(false);
      setError(true);
    }
  }, [update]);

  if (error) {
    return (
      <div className="fixed bottom-4 left-1/2 z-[10000] -translate-x-1/2 rounded-md border border-destructive bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg">
        <div className="flex items-center gap-3">
          <span>{t("update:error")}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setError(false)}
          >
            {t("actions:close")}
          </Button>
        </div>
      </div>
    );
  }

  if (!open) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[10000] -translate-x-1/2 rounded-md border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg">
      <div className="flex items-center gap-3">
        <span>
          {installing ? t("update:installing") : t("update:available")}
        </span>
        {installing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              {t("update:dismiss")}
            </Button>
            <Button type="button" size="sm" onClick={handleInstall}>
              {t("update:install")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
