import type { SupportedLanguage } from "@mason-gallery/i18n";
import { EmbeddedWebApp } from "./app/EmbeddedWebApp";
import { WebRuntimeProvider } from "./app/WebRuntimeProvider";

export default function EmbeddedApp({ locale }: { locale: SupportedLanguage }) {
  return (
    <WebRuntimeProvider>
      <EmbeddedWebApp locale={locale} />
    </WebRuntimeProvider>
  );
}
