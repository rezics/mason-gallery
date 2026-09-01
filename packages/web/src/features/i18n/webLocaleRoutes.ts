import {
  fallbackLanguage,
  isSupportedLanguage,
  resolvePreferredLanguage,
  type SupportedLanguage,
} from "@mason-gallery/i18n";

export function getWebLocaleFromPathname(
  pathname: string,
): SupportedLanguage | undefined {
  const [segment] = pathname.split("/").filter(Boolean);
  return isSupportedLanguage(segment) ? segment : undefined;
}

export function getLocalizedWebPath(
  path: "/" | "/about",
  locale: SupportedLanguage,
): string {
  const suffix = path === "/" ? "" : "about/";
  return `/${locale}/${suffix}`;
}

export function getWebAppHref(locale: SupportedLanguage): string {
  return `/app/?lang=${locale}`;
}

export function getWebAppSettingsHref(
  locale: SupportedLanguage,
  category: "general" | "gallery" | "appearance" = "general",
): string {
  return `/app/settings/${category}/?lang=${locale}`;
}

function getBrowserLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [fallbackLanguage];
  return navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
}

export function getBrowserLanguage(): SupportedLanguage {
  return resolvePreferredLanguage(getBrowserLanguages());
}

export function getWebLocaleFromSearch(
  search: string,
): SupportedLanguage | undefined {
  const value = new URLSearchParams(search).get("lang");
  return isSupportedLanguage(value) ? value : undefined;
}

export function getInitialWebLanguage(
  pathname: string,
  storedLanguage: unknown,
  search = "",
  browserLanguages: Iterable<unknown> = getBrowserLanguages(),
): SupportedLanguage {
  return (
    getWebLocaleFromSearch(search) ??
    getWebLocaleFromPathname(pathname) ??
    resolvePreferredLanguage(
      [storedLanguage],
      resolvePreferredLanguage(browserLanguages),
    )
  );
}
