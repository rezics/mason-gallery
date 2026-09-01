import {
  CircleHelp,
  Clock,
  Database,
  Images,
  Library,
  PanelLeftClose,
  Settings,
  Star,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";

function SidebarLink({
  href,
  label,
  icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-xl px-3 text-sm text-sidebar-foreground/70 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        active &&
          "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useI18n();
  const platform = usePlatform();
  const [location] = useLocation();
  const setAppSidebarOpen = useAppStore((s) => s.setAppSidebarOpen);
  const libraryRoot =
    location === "/" || location === "/library" || location === "/library/";

  const links = [
    {
      href: "/library",
      label: t("library:allGalleries"),
      icon: <Library />,
      active: libraryRoot,
    },
    {
      href: "/library/favorites",
      label: t("library:favorites"),
      icon: <Star />,
      active: location.startsWith("/library/favorites"),
    },
    {
      href: "/library/recent",
      label: t("library:recent"),
      icon: <Clock />,
      active: location.startsWith("/library/recent"),
    },
    {
      href: "/gallery",
      label: t("library:browse"),
      icon: <Images />,
      active: location.startsWith("/gallery"),
    },
  ];

  return (
    <div className="flex h-full flex-col bg-sidebar px-3 py-4 text-sidebar-foreground">
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
        <section className="flex flex-col gap-1">
          <h2 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
            {t("library:library")}
          </h2>
          {links.map((link) => (
            <SidebarLink key={link.href} {...link} onNavigate={onNavigate} />
          ))}
        </section>

        <section className="flex flex-col gap-1">
          <h2 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
            {t("library:manage")}
          </h2>
          {platform.capabilities.canBrowseArchives && (
            <SidebarLink
              href="/manage/cache"
              label={t("archive:cacheManagement")}
              icon={<Database />}
              active={
                location.startsWith("/manage/cache") || location === "/cache"
              }
              onNavigate={onNavigate}
            />
          )}
          <SidebarLink
            href="/settings/general"
            label={t("settings:preferences")}
            icon={<Settings />}
            active={location.startsWith("/settings")}
            onNavigate={onNavigate}
          />
        </section>
        <section className="flex flex-col gap-1">
          <SidebarLink
            href="/about"
            label={t("menu:about")}
            icon={<CircleHelp />}
            active={location.startsWith("/about")}
            onNavigate={onNavigate}
          />
        </section>
      </nav>

      <div className="flex items-center gap-2 border-t border-sidebar-border px-1 pt-3">
        <p className="min-w-0 flex-1 truncate px-2 text-xs text-sidebar-foreground/45">
          {t("about:version")} 2.2.0
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-sidebar-foreground/45 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          title={t("sidebar:collapse")}
          aria-label={t("sidebar:collapse")}
          onClick={() => {
            setAppSidebarOpen(false);
            onNavigate?.();
          }}
        >
          <PanelLeftClose />
        </Button>
      </div>
    </div>
  );
}
