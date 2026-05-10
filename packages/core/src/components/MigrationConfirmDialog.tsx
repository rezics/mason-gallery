import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
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
    <Dialog
      open={open}
      title={t.archive.migrationTitle}
      className="max-w-lg"
      actions={
        <>
          <Button type="button" variant="ghost" onClick={onScanFresh}>
            {t.archive.scanFresh}
          </Button>
          <Button type="button" onClick={onUseCache}>
            {t.archive.useCache}
          </Button>
        </>
      }
    >
      <p>{t.archive.migrationMessage}</p>
      <p className="break-all text-xs text-muted-foreground">{oldPath}</p>
      <p className="break-all text-xs text-muted-foreground">{newPath}</p>
    </Dialog>
  );
}
