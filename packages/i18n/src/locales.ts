export const supportedLanguages = ["en", "zh-hans", "zh-hant", "ja"] as const;
export const fallbackLanguage = "en";

export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageLabels: Record<SupportedLanguage, string> = {
  en: "English",
  "zh-hans": "简体中文",
  "zh-hant": "繁體中文",
  ja: "日本語",
};

const supportedLanguageSet: ReadonlySet<string> = new Set(supportedLanguages);

export function isSupportedLanguage(
  value: unknown,
): value is SupportedLanguage {
  return typeof value === "string" && supportedLanguageSet.has(value);
}

export function matchSupportedLanguage(
  value: unknown,
): SupportedLanguage | undefined {
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase().replaceAll("_", "-");
  if (isSupportedLanguage(normalized)) return normalized;

  if (normalized === "zh" || normalized.startsWith("zh-")) {
    if (
      normalized.startsWith("zh-hant") ||
      ["zh-tw", "zh-hk", "zh-mo"].some((prefix) =>
        normalized.startsWith(prefix),
      )
    ) {
      return "zh-hant";
    }
    return "zh-hans";
  }

  const [baseLanguage] = normalized.split("-");
  if (baseLanguage === "ja") return "ja";
  if (baseLanguage === "en") return "en";
  return undefined;
}

export function resolvePreferredLanguage(
  values: Iterable<unknown>,
  defaultLanguage: SupportedLanguage = fallbackLanguage,
): SupportedLanguage {
  for (const value of values) {
    const language = matchSupportedLanguage(value);
    if (language) return language;
  }

  return defaultLanguage;
}

function parseQuality(parameters: readonly string[]): number {
  const qualityParameter = parameters.find((parameter) =>
    parameter.trim().toLowerCase().startsWith("q="),
  );
  if (!qualityParameter) return 1;

  const rawQuality = qualityParameter.trim().slice(2);
  if (!/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(rawQuality)) return 0;
  return Number(rawQuality);
}

export function negotiateLanguage(
  acceptLanguage: string | null | undefined,
  defaultLanguage: SupportedLanguage = fallbackLanguage,
): SupportedLanguage {
  if (!acceptLanguage) return defaultLanguage;

  const preferences = acceptLanguage
    .split(",")
    .map((entry, index) => {
      const [tag = "", ...parameters] = entry.trim().split(";");
      return { tag, index, quality: parseQuality(parameters) };
    })
    .filter(({ tag, quality }) => tag.length > 0 && quality > 0)
    .sort(
      (left, right) => right.quality - left.quality || left.index - right.index,
    );

  return resolvePreferredLanguage(
    preferences.map(({ tag }) => tag),
    defaultLanguage,
  );
}

export function resolveSupportedLanguage(
  value: unknown,
  defaultLanguage: SupportedLanguage = fallbackLanguage,
): SupportedLanguage {
  return isSupportedLanguage(value) ? value : defaultLanguage;
}
