import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { supportedLanguages } from "@mason-gallery/i18n";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const distDir = join(packageRoot, "dist");
const source = join(distDir, "index.html");

const htmlLang = {
  en: "en",
  "zh-hans": "zh-Hans",
  "zh-hant": "zh-Hant",
  ja: "ja",
};

const routeEntries = [
  "about/index.html",
  "settings/index.html",
  "settings/gallery/index.html",
  "settings/appearance/index.html",
];

await Promise.all(
  routeEntries.map(async (entry) => {
    const target = join(distDir, entry);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }),
);

const sourceHtml = await readFile(source, "utf8");
await Promise.all(
  supportedLanguages.flatMap((language) =>
    [`${language}/index.html`, `${language}/about/index.html`].map(
      async (entry) => {
        const target = join(distDir, entry);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(
          target,
          sourceHtml.replace('<html lang="en">', `<html lang="${htmlLang[language]}">`),
        );
      },
    ),
  ),
);