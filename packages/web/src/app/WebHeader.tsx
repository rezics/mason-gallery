import type { SupportedLanguage } from "@mason-gallery/i18n";
import {
  Check,
  Globe2,
  Home,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  Settings,
} from "lucide-react";
import type { MouseEvent, MouseEventHandler, ReactNode } from "react";

type HeaderItem = "preferences" | "about";

type GalleryActions = {
  homeLabel: string;
  refreshLabel: string;
  foldersLabel: string;
  isSidebarOpen: boolean;
  isScanning: boolean;
  onHome: () => void;
  onRefresh: () => void;
  onToggleSidebar: () => void;
};

export type HeaderLanguageOption = {
  language: SupportedLanguage;
  label: string;
  href: string;
};

type LanguageMenu = {
  label: string;
  currentLanguage: SupportedLanguage;
  options: HeaderLanguageOption[];
  onSelect?: (
    language: SupportedLanguage,
    event: MouseEvent<HTMLAnchorElement>,
  ) => void;
};

type WebHeaderProps = {
  preferencesLabel: string;
  aboutLabel: string;
  brandHref: string;
  preferencesHref: string;
  aboutHref: string;
  activeItem?: HeaderItem;
  languageMenu: LanguageMenu;
  galleryActions?: GalleryActions;
  onBrandClick?: MouseEventHandler<HTMLAnchorElement>;
  onPreferencesClick?: MouseEventHandler<HTMLAnchorElement>;
};

function headerItemClass(active = false): string {
  return [
    "inline-flex h-10 items-center gap-2 rounded-md px-2 text-sm font-medium transition sm:px-3",
    active
      ? "bg-secondary text-foreground"
      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
  ].join(" ");
}

function HeaderButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      className={`${headerItemClass()} disabled:pointer-events-none disabled:opacity-35`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function WebHeader({
  preferencesLabel,
  aboutLabel,
  brandHref,
  preferencesHref,
  aboutHref,
  activeItem,
  languageMenu,
  galleryActions,
  onBrandClick,
  onPreferencesClick,
}: WebHeaderProps) {
  return (
    <header className="z-10 shrink-0 border-b border-border bg-background/90 shadow-sm shadow-foreground/5 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:gap-4 sm:px-10 lg:px-16">
        <a
          href={brandHref}
          aria-label="Mason Gallery"
          className="flex min-w-0 items-center gap-3 rounded-md pr-2 text-left"
          onClick={onBrandClick}
        >
          <img src="/logo/logo.svg" alt="" className="size-8" />
          <span className="hidden min-w-0 whitespace-nowrap text-lg font-semibold leading-6 text-foreground min-[375px]:block sm:text-xl">
            Mason Gallery
          </span>
        </a>

        <div className="min-w-4 flex-1" />

        <nav className="flex items-center gap-1 sm:gap-4" aria-label="Primary">
          {galleryActions ? (
            <>
              <HeaderButton
                title={galleryActions.homeLabel}
                onClick={galleryActions.onHome}
              >
                <Home className="size-5" />
                <span className="hidden sm:inline">
                  {galleryActions.homeLabel}
                </span>
              </HeaderButton>
              <HeaderButton
                title={galleryActions.refreshLabel}
                disabled={galleryActions.isScanning}
                onClick={galleryActions.onRefresh}
              >
                <RefreshCcw className="size-5" />
                <span className="hidden sm:inline">
                  {galleryActions.refreshLabel}
                </span>
              </HeaderButton>
              <HeaderButton
                title={galleryActions.foldersLabel}
                onClick={galleryActions.onToggleSidebar}
              >
                {galleryActions.isSidebarOpen ? (
                  <PanelLeftClose className="size-5" />
                ) : (
                  <PanelLeftOpen className="size-5" />
                )}
                <span className="hidden sm:inline">
                  {galleryActions.foldersLabel}
                </span>
              </HeaderButton>
            </>
          ) : null}

          <details className="group relative shrink-0" data-language-menu>
            <summary
              title={languageMenu.label}
              aria-label={languageMenu.label}
              className="inline-flex size-10 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
            >
              <Globe2 className="size-5" />
            </summary>
            <div className="absolute right-0 top-12 z-50 grid min-w-40 gap-1 rounded-lg border border-border bg-popover p-2 text-sm text-popover-foreground shadow-xl">
              {languageMenu.options.map((option) => {
                const isCurrent =
                  option.language === languageMenu.currentLanguage;
                return (
                  <a
                    key={option.language}
                    href={option.href}
                    lang={option.language}
                    aria-current={isCurrent ? "true" : undefined}
                    className={`flex items-center justify-between gap-4 rounded-md px-3 py-2 transition hover:bg-accent ${
                      isCurrent ? "bg-accent font-semibold" : ""
                    }`}
                    onClick={(event) => {
                      languageMenu.onSelect?.(option.language, event);
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                    }}
                  >
                    <span>{option.label}</span>
                    {isCurrent ? <Check className="size-4" /> : null}
                  </a>
                );
              })}
            </div>
          </details>

          <a
            title={preferencesLabel}
            aria-label={preferencesLabel}
            href={preferencesHref}
            className={headerItemClass(activeItem === "preferences")}
            onClick={onPreferencesClick}
          >
            <Settings className="size-5" />
            <span className="hidden sm:inline">{preferencesLabel}</span>
          </a>
          <a
            title={aboutLabel}
            aria-label={aboutLabel}
            href={aboutHref}
            className={headerItemClass(activeItem === "about")}
          >
            <Info className="size-5" />
            <span className="hidden sm:inline">{aboutLabel}</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
