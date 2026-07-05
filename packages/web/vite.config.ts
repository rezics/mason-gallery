import { readFile } from "node:fs/promises";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const coreSrc = path.resolve(__dirname, "../core/src");
const r2ProxyOrigin =
  process.env.MASON_GALLERY_R2_PROXY_ORIGIN ?? "https://mason-gallery.rezics.com";

const devHtmlLang: Record<string, string> = {
  en: "en",
  "zh-hans": "zh-Hans",
  "zh-hant": "zh-Hant",
  ja: "ja",
};

function getDevLocaleHtmlLang(url: string | undefined): string | null {
  const pathname = new URL(url ?? "/", "http://localhost").pathname;
  const segments = pathname.split("/").filter(Boolean);
  const [locale, page] = segments;
  if (!locale || !(locale in devHtmlLang)) return null;
  return segments.length === 1 || (segments.length === 2 && page === "about")
    ? devHtmlLang[locale]
    : null;
}
export default defineConfig({
  publicDir: path.resolve(__dirname, "../../public"),
  plugins: [
    {
      name: "mason-gallery-dev-locale-html",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.method !== "GET") return next();
          const lang = getDevLocaleHtmlLang(req.url);
          if (!lang) return next();

          try {
            const template = await readFile(
              path.resolve(__dirname, "index.html"),
              "utf8",
            );
            const html = await server.transformIndexHtml(
              req.url ?? "/",
              template.replace('<html lang="en">', `<html lang="${lang}">`),
            );
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html");
            res.end(html);
          } catch (error) {
            next(error as Error);
          }
        });
      },
    },
    react(),
    tailwindcss(),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      {
        find: /^@mason-gallery\/core\/src\/(.*)$/,
        replacement: `${coreSrc}/$1`,
      },
      {
        find: /^@mason-gallery\/core\/(.*)$/,
        replacement: `${coreSrc}/$1`,
      },
      {
        find: "@mason-gallery/core",
        replacement: path.resolve(coreSrc, "index.ts"),
      },
      {
        find: "@/",
        replacement: `${coreSrc}/`,
      },
    ],
  },
  base: "./",
  server: {
    proxy: {
      "/r2": {
        target: r2ProxyOrigin,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
