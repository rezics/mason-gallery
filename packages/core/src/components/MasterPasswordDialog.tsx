import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useState } from "react";
import { useI18n } from "@/i18n";

interface MasterPasswordDialogProps {
  open: boolean;
  mode: "set" | "enter";
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

export default function MasterPasswordDialog({
  open,
  mode,
  onSubmit,
  onCancel,
}: MasterPasswordDialogProps) {
  const t = useI18n();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = useCallback(() => {
    if (mode === "set") {
      if (password !== confirmPassword) {
        setError(t.archive.masterPasswordMismatch);
        return;
      }
    }
    if (password) {
      onSubmit(password);
      setPassword("");
      setConfirmPassword("");
      setError("");
    }
  }, [password, confirmPassword, mode, onSubmit, t]);

  const title =
    mode === "set"
      ? t.archive.setMasterPassword
      : t.archive.enterMasterPassword;

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          type="password"
          placeholder={t.archive.enterMasterPassword}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && mode === "enter") handleSubmit();
          }}
          size="small"
          sx={{ mt: 1 }}
        />
        {mode === "set" && (
          <TextField
            fullWidth
            type="password"
            placeholder={t.archive.confirmMasterPassword}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            error={!!error}
            helperText={error}
            size="small"
            sx={{ mt: 2 }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{t.archive.cancel}</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!password}>
          {t.archive.submit}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
