import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export default function AboutPage() {
  const t = useI18n();

  return (
    <div className="flex h-full flex-col overflow-auto bg-background">
      <PageHeader
        title={t("about:title")}
        description={t("about:description")}
      />
      <div className="px-5 py-6 sm:px-7">
        <section className="max-w-3xl rounded-xl border border-border bg-card p-6 text-card-foreground">
          <div className="flex items-center gap-4">
            <img
              src="/logo/logo.svg"
              alt=""
              className="size-14"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-lg font-semibold">{t("common:appName")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("about:version")}: 2.1.0
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-xl text-sm leading-6 text-muted-foreground">
            {t("about:description")}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-6"
            onClick={() =>
              window.open(
                "https://github.com/Edge-coordinates/mason-gallery",
                "_blank",
              )
            }
          >
            <ExternalLink />
            {t("about:github")}
          </Button>
        </section>
      </div>
    </div>
  );
}
