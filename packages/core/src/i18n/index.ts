import {
  defaultNamespace,
  fallbackLanguage,
  namespaces,
  resolveSupportedLanguage,
  resources,
  type SupportedLanguage,
  supportedLanguages,
} from "@mason-gallery/i18n";
import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";

void i18next.use(initReactI18next).init({
  resources,
  lng: fallbackLanguage,
  fallbackLng: fallbackLanguage,
  supportedLngs: [...supportedLanguages],
  lowerCaseLng: true,
  load: "currentOnly",
  ns: namespaces,
  defaultNS: defaultNamespace,
  interpolation: {
    escapeValue: false,
    prefix: "{",
    suffix: "}",
  },
  react: {
    useSuspense: false,
  },
  returnNull: false,
  initImmediate: false,
});

export const i18n = i18next;

export function setI18nLanguage(language: SupportedLanguage): void {
  const normalized = resolveSupportedLanguage(language);
  if (typeof document !== "undefined") {
    document.documentElement.lang = normalized;
  }
  if (i18next.language !== normalized) {
    void i18next.changeLanguage(normalized);
  }
}

export function useI18n() {
  return useTranslation(namespaces).t;
}

export type { Namespace, SupportedLanguage } from "@mason-gallery/i18n";
