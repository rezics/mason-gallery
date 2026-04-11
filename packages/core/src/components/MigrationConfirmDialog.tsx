import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { useI18n } from "@/i18n";

interface MigrationConfirmDialogProps {
  open: boolean;
  oldPath: string;
  newPath: string;
  onUseCache: () => void;
  onScanFresh: () => void;
}

export default function MigrationConfirmDialog({
  open,
  oldPath,
  newPath,
  onUseCache,
  onScanFresh,
}: MigrationConfirmDialogProps) {
  const t = useI18n();

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>{t.archive.migrationTitle}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {t.archive.migrationMessage}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          component="div"
          sx={{ mb: 1 }}
        >
          {oldPath}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          {newPath}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onScanFresh}>{t.archive.scanFresh}</Button>
        <Button onClick={onUseCache} variant="contained">
          {t.archive.useCache}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
