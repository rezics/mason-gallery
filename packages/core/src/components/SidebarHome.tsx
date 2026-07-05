import { Database, HelpCircle, Images, Palette, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

function HomeNavLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
        active && "bg-accent text-accent-foreground",
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

export default function SidebarHome() {
  const t = useI18n();
  const platform = usePlatform();
  const [location] = useLocation();
  const canBrowseArchives = platform.capabilities.canBrowseArchives;

  return (
    <aside className="sidebar-home hidden h-full w-60 shrink-0 border-r border-border bg-muted/25 px-3 py-4 md:flex md:flex-col">
      <nav className="space-y-5">
        <section className="space-y-1">
          <h2 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("actions:gallery")}
          </h2>
          <HomeNavLink
            href="/"
            icon={<Images />}
            label={t("actions:gallery")}
            active={location === "/"}
          />
        </section>

        <section className="space-y-1">
          <h2 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("settings:preferences")}
          </h2>
          <HomeNavLink
            href="/settings/appearance"
            icon={<Palette />}
            label={t("settings:appearance")}
            active={location.startsWith("/settings/appearance")}
          />
          <HomeNavLink
            href="/settings/gallery"
            icon={<Settings />}
            label={t("settings:gallery")}
            active={location.startsWith("/settings/gallery")}
          />
          {canBrowseArchives && (
            <HomeNavLink
              href="/manage/cache"
              icon={<Database />}
              label={t("archive:cacheManagement")}
              active={location.startsWith("/manage/cache")}
            />
          )}
        </section>

        <section className="space-y-1">
          <h2 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("menu:help")}
          </h2>
          <HomeNavLink
            href="/about"
            icon={<HelpCircle />}
            label={t("menu:about")}
            active={location.startsWith("/about")}
          />
        </section>
      </nav>

      <div className="mt-auto border-t border-border pt-3 text-xs text-muted-foreground">
        {t("about:version")}: 2.0.0
      </div>
    </aside>
  );
}
