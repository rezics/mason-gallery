import { cloneElement, isValidElement, type ReactNode } from "react";
import { Field, FieldDescription, FieldTitle } from "@/components/ui/field";
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
  const control =
    isValidElement<{ "aria-label"?: string }>(children) &&
    children.type !== "div"
      ? cloneElement(
          children,
          children.props["aria-label"] ? undefined : { "aria-label": label },
        )
      : children;

  return (
    <Field>
      <FieldTitle>{label}</FieldTitle>
      {control}
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}

export function SettingsSection({ children }: { children: ReactNode }) {
  return (
    <section className="grid gap-6 rounded-2xl border bg-card p-5 text-card-foreground shadow-xs">
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
