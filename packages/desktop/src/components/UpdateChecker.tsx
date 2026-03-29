import { useI18n } from "@mason-gallery/core";
import { Alert, Button, CircularProgress, Snackbar } from "@mui/material";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
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
      <Snackbar
        open
        autoHideDuration={5000}
        onClose={() => setError(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setError(false)}>
          {t.update.error}
        </Alert>
      </Snackbar>
    );
  }

  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert
        severity="info"
        action={
          installing ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            <>
              <Button
                color="inherit"
                size="small"
                onClick={() => setOpen(false)}
              >
                {t.update.dismiss}
              </Button>
              <Button color="inherit" size="small" onClick={handleInstall}>
                {t.update.install}
              </Button>
            </>
          )
        }
      >
        {installing ? t.update.installing : t.update.available}
      </Alert>
    </Snackbar>
  );
}
