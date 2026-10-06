import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useLocation } from "wouter";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n";
import {
  ApplicationActionsContext,
  useActionInputs,
} from "@/input/useActionInputs";
import { useAppStore } from "@/stores/appStore";
import { useViewerStore } from "@/stores/viewerStore";

export function AppShell({ children }: { children: ReactNode }) {
  const t = useI18n();
  const [, navigate] = useLocation();
  const applicationHandlers = {
    "app.settings": () => {
      useViewerStore.getState().closeViewer();
      navigate("/settings");
    },
  };
  useActionInputs("app", applicationHandlers);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAppSidebarOpen = useAppStore((s) => s.isAppSidebarOpen);

  return (
    <ApplicationActionsContext.Provider value={applicationHandlers}>
      <TooltipProvider>
        <div className="flex h-full min-w-0 overflow-hidden bg-background">
          {isAppSidebarOpen ? (
            <aside className="hidden h-full w-[232px] shrink-0 border-r border-sidebar-border md:block">
              <AppSidebar />
            </aside>
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 md:hidden">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("library:library")}
                onClick={() => setMobileOpen(true)}
              >
                <Menu />
              </Button>
              <img
                src="/logo/logo.svg"
                alt=""
                className="size-6"
                aria-hidden="true"
              />
              <span className="text-sm font-semibold">
                {t("common:appName")}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent
              side="left"
              className="top-9 bottom-0 h-auto w-[232px] max-w-[85vw] p-0"
              showCloseButton={false}
            >
              <SheetHeader className="sr-only">
                <SheetTitle>{t("library:library")}</SheetTitle>
                <SheetDescription>{t("common:appName")}</SheetDescription>
              </SheetHeader>
              <AppSidebar onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </TooltipProvider>
    </ApplicationActionsContext.Provider>
  );
}
