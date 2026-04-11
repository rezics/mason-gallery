import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { useI18n } from "@/i18n";

interface SolidArchiveWarningDialogProps {
  open: boolean;
  onContinue: () => void;
  onCancel: () => void;
}

export default function SolidArchiveWarningDialog({
  open,
  onContinue,
  onCancel,
}: SolidArchiveWarningDialogProps) {
  const t = useI18n();

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{t.archive.solidWarningTitle}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          {t.archive.solidWarningMessage}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{t.archive.cancel}</Button>
        <Button onClick={onContinue} variant="contained">
          {t.archive.continueAnyway}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
