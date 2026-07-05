import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
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
    <Dialog
      open={open}
      title={t("archive:solidWarningTitle")}
      onClose={onCancel}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("archive:cancel")}
          </Button>
          <Button type="button" onClick={onContinue}>
            {t("archive:continueAnyway")}
          </Button>
        </>
      }
    >
      <p>{t("archive:solidWarningMessage")}</p>
    </Dialog>
  );
}
