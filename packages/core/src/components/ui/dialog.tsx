import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  title?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  className?: string;
}

export function Dialog({
  open,
  title,
  children,
  actions,
  onClose,
  className,
}: DialogProps) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full max-w-md rounded-lg border border-border bg-popover p-5 text-popover-foreground shadow-xl",
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose?.();
        }}
      >
        {title && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
        <div className="space-y-3 text-sm">{children}</div>
        {actions && (
          <div className="mt-5 flex justify-end gap-2">{actions}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  children,
  cancelLabel,
  confirmLabel,
  destructive,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
