import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Input } from "@/components/ui/field";
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

  const handleCancel = useCallback(() => {
    setPassword("");
    setRemember(false);
    onCancel();
  }, [onCancel]);

  return (
    <Dialog
      open={open}
      title={t("archive:passwordRequired")}
      onClose={handleCancel}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={handleCancel}>
            {t("archive:cancel")}
          </Button>
          <Button type="button" disabled={!password} onClick={handleSubmit}>
            {t("archive:submit")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        {archivePath.split(/[\\/]/).pop()}
      </p>
      <Input
        autoFocus
        type="password"
        placeholder={t("archive:passwordPlaceholder")}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") handleSubmit();
        }}
        aria-invalid={!!error}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={remember}
          onChange={(event) => setRemember(event.currentTarget.checked)}
        />
        {t("archive:rememberPassword")}
      </div>
    </Dialog>
  );
}
