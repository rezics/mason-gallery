export function sourceLabelFromLocator(locator: string): string {
  const normalized = locator.replace(/\\/g, "/").replace(/\/+$/g, "");
  try {
    return decodeURIComponent(normalized.split("/").pop() || locator);
  } catch {
    return normalized.split("/").pop() || locator;
  }
}

export function normalizeSourceLocator(locator: string): string {
  return locator
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/g, "")
    .toLocaleLowerCase();
}
