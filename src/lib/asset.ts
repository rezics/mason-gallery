export function toAssetUrl(filePath: string): string {
  const encoded = encodeURIComponent(filePath)
    .replace(/%2F/g, "/")
    .replace(/%3A/g, ":");
  return `asset://localhost/${encoded}`;
}
