import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useState } from "react";
import { useI18n } from "@/i18n";

interface PasswordDialogProps {
  open: boolean;
  archivePath: string;
  onSubmit: (password: string, remember: boolean) => void;
  onCancel: () => void;
  error?: string;
}

export default function PasswordDialog({
  open,
  archivePath,
  onSubmit,
  onCancel,
  error,
}: PasswordDialogProps) {
  const t = useI18n();
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  const handleSubmit = useCallback(() => {
    if (password) {
      onSubmit(password, remember);
      setPassword("");
    }
  }, [password, remember, onSubmit]);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{t.archive.passwordRequired}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {archivePath.split(/[\\/]/).pop()}
        </Typography>
        <TextField
          autoFocus
          fullWidth
          type="password"
          placeholder={t.archive.passwordPlaceholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          error={!!error}
          helperText={error}
          size="small"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              size="small"
            />
          }
          label={t.archive.rememberPassword}
          sx={{ mt: 1 }}
        />
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
