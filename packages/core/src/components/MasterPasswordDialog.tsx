import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
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
    if (mode === "set" && password !== confirmPassword) {
      setError(t.archive.masterPasswordMismatch);
      return;
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
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t.archive.cancel}
          </Button>
          <Button type="button" disabled={!password} onClick={handleSubmit}>
            {t.archive.submit}
          </Button>
        </>
      }
    >
      <Input
        autoFocus
        type="password"
        placeholder={t.archive.enterMasterPassword}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && mode === "enter") handleSubmit();
        }}
      />
      {mode === "set" && (
        <Input
          type="password"
          placeholder={t.archive.confirmMasterPassword}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSubmit();
          }}
          aria-invalid={!!error}
        />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </Dialog>
  );
}
