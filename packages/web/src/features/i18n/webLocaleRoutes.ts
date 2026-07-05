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
  if (!locale) return path;
  return path === "/" ? `/${locale}/` : `/${locale}${path}`;
}

export function getBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === "undefined") return fallbackLanguage;
  const languages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  return resolvePreferredLanguage(languages);
}

export function getInitialWebLanguage(
  pathname: string,
  storedLanguage: unknown,
): SupportedLanguage {
  return (
    getWebLocaleFromPathname(pathname) ??
    resolvePreferredLanguage([storedLanguage], getBrowserLanguage())
  );
}
