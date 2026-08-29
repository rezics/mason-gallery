import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { useI18n } from "@/i18n";

interface MasterPasswordDialogProps {
  open: boolean;
  mode: "set" | "enter";
  onSubmit: (password: string) => boolean | Promise<boolean>;
  onCancel: () => void;
  error?: string;
}

export default function MasterPasswordDialog({
  open,
  mode,
  onSubmit,
  onCancel,
  error: externalError,
}: MasterPasswordDialogProps) {
  const t = useI18n();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (mode === "set" && password !== confirmPassword) {
      setError(t("archive:masterPasswordMismatch"));
      return;
    }
    if (password) {
      setIsSubmitting(true);
      try {
        if (await onSubmit(password)) {
          setPassword("");
          setConfirmPassword("");
          setError("");
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [password, confirmPassword, mode, onSubmit, t]);

  const handleCancel = useCallback(() => {
    setPassword("");
    setConfirmPassword("");
    setError("");
    onCancel();
  }, [onCancel]);

  const title =
    mode === "set"
      ? t("archive:setMasterPassword")
      : t("archive:enterMasterPassword");

  return (
    <Dialog
      open={open}
      title={title}
      onClose={handleCancel}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={handleCancel}>
            {t("archive:cancel")}
          </Button>
          <Button
            type="button"
            disabled={!password || isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {t("archive:submit")}
          </Button>
        </>
      }
    >
      <Input
        autoFocus
        type="password"
        placeholder={t("archive:enterMasterPassword")}
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          setError("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && mode === "enter") {
            void handleSubmit();
          }
        }}
        aria-invalid={!!(error || externalError)}
      />
      {mode === "set" && (
        <Input
          type="password"
          placeholder={t("archive:confirmMasterPassword")}
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleSubmit();
          }}
          aria-invalid={!!(error || externalError)}
        />
      )}
      {(error || externalError) && (
        <p className="text-xs text-destructive">{error || externalError}</p>
      )}
    </Dialog>
  );
}
