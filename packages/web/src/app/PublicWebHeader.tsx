import { useCoreRuntime, useSettingsStore } from "@mason-gallery/core";
import type { SupportedLanguage } from "@mason-gallery/i18n";
import type { MouseEvent } from "react";
import { useEffect } from "react";
import {
  getLocalizedPath,
  publicLocales,
  siteContent,
} from "../content/siteContent";
import { WebHeader } from "./WebHeader";
import { WebRuntimeProvider } from "./WebRuntimeProvider";

type PublicWebHeaderProps = {
  locale: SupportedLanguage;
  page: "home" | "about";
};

function PublicWebHeaderContent({ locale, page }: PublicWebHeaderProps) {
  const { hydrated } = useCoreRuntime({
    enableStartupCacheCleanup: false,
    enableThumbnailEvents: false,
  });
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const content = siteContent[locale];
  const homePath = getLocalizedPath(locale, "home");
  const aboutPath = getLocalizedPath(locale, "about");
  const preferencesPath = `/app/settings/general/?lang=${locale}`;

  useEffect(() => {
    if (hydrated && language !== locale) setLanguage(locale);
  }, [hydrated, language, locale, setLanguage]);

  const handleLanguageSelect = (
    nextLanguage: SupportedLanguage,
    _event: MouseEvent<HTMLAnchorElement>,
  ) => {
    setLanguage(nextLanguage);
  };

  return (
    <WebHeader
      preferencesLabel={content.preferences}
      aboutLabel={content.navAbout}
      brandHref={homePath}
      preferencesHref={preferencesPath}
      aboutHref={aboutPath}
      activeItem={page === "about" ? "about" : undefined}
      languageMenu={{
        label: content.languageMenuLabel,
        currentLanguage: locale,
        options: publicLocales.map((optionLocale) => ({
          language: optionLocale,
          label: siteContent[optionLocale].languageName,
          href: getLocalizedPath(optionLocale, page),
        })),
        onSelect: handleLanguageSelect,
      }}
    />
  );
}

export default function PublicWebHeader(props: PublicWebHeaderProps) {
  return (
    <WebRuntimeProvider>
      <PublicWebHeaderContent {...props} />
    </WebRuntimeProvider>
  );
}
