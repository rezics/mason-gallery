import { fileURLToPath } from "node:url";
import path from "node:path";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const coreSrc = path.resolve(packageRoot, "../core/src");

export default defineConfig({
  site: "https://mason-gallery.rezics.com",
  output: "static",
  trailingSlash: "always",
  publicDir: path.resolve(packageRoot, "../../public"),
  outDir: path.resolve(packageRoot, "dist"),
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        const pathname = new URL(page).pathname;
        return (
          !pathname.startsWith("/app/") &&
          pathname !== "/" &&
          pathname !== "/about/"
        );
      },
      i18n: {
        defaultLocale: "en",
        locales: {
          en: "en",
          "zh-hans": "zh-Hans",
          "zh-hant": "zh-Hant",
          ja: "ja",
        },
      },
    }),
  ],
  i18n: {
    defaultLocale: "en",
    locales: ["en", "zh-hans", "zh-hant", "ja"],
    routing: {
      prefixDefaultLocale: true,
    },
  },
  vite: {
    plugins: [tailwindcss()],
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
    server: {
      proxy: {
        "/r2": {
          target:
            process.env.MASON_GALLERY_R2_PROXY_ORIGIN ??
            "https://mason-gallery.rezics.com",
          changeOrigin: true,
        },
      },
    },
  },
});
