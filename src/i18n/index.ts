import { createContext, useContext } from "react";
import en from "./en";
import type { Locales, TranslationKeys } from "./i18n-types";
import zh from "./zh";

const translations: Record<Locales, TranslationKeys> = { en, zh };

export function getTranslations(locale: Locales): TranslationKeys {
  return translations[locale];
}

export const I18nContext = createContext<TranslationKeys>(en);

export function useI18n(): TranslationKeys {
  return useContext(I18nContext);
}

export type { Locales, TranslationKeys };
