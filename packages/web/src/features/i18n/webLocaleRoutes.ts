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
  locale: SupportedLanguage | undefined,
): string {
  const suffix = path === "/" ? "" : "about/";
  if (!locale || locale === "en") return `/${suffix}`;
  return `/${locale}/${suffix}`;
}

export function getBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === "undefined") return fallbackLanguage;
  const languages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  return resolvePreferredLanguage(languages);
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
): SupportedLanguage {
  return (
    getWebLocaleFromSearch(search) ??
    getWebLocaleFromPathname(pathname) ??
    resolvePreferredLanguage([storedLanguage], getBrowserLanguage())
  );
}
