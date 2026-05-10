import { ArrowLeft, Github } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export default function AboutPage() {
  const t = useI18n();
  const [, navigate] = useLocation();

  return (
    <div className="flex h-full items-center justify-center p-6">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center text-card-foreground shadow-sm">
        <h1 className="text-2xl font-semibold">{t.about.title}</h1>
        <p className="mt-3 text-muted-foreground">{t.about.description}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.about.version}: 2.0.0
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft />
            Back
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.open("https://github.com", "_blank")}
          >
            <Github />
            {t.about.github}
          </Button>
        </div>
      </section>
    </div>
  );
}
