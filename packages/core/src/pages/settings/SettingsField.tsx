import type { ReactNode } from "react";
import type { CachePolicy } from "@/types/platform";

export const MB = 1024 * 1024;

export function SettingsField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function SettingsSection({ children }: { children: ReactNode }) {
  return (
    <section className="grid gap-5 rounded-lg border border-border bg-card p-5 text-card-foreground">
      {children}
    </section>
  );
}

export function updatePolicy(
  policy: CachePolicy,
  setPolicy: (policy: CachePolicy) => void,
  patch: Partial<CachePolicy>,
) {
  setPolicy({ ...policy, ...patch });
}
