import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";
import { Button, type ButtonProps } from "./ui/button";

interface BackButtonProps
  extends Omit<ButtonProps, "children" | "onClick" | "type"> {
  to?: string;
}

export function BackButton({ to = "/", ...props }: BackButtonProps) {
  const t = useI18n();
  const [, navigate] = useLocation();

  return (
    <Button type="button" onClick={() => navigate(to)} {...props}>
      <ArrowLeft />
      {t("actions:back")}
    </Button>
  );
}
