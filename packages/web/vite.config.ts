import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const coreSrc = path.resolve(__dirname, "../core/src");

export default defineConfig({
  publicDir: path.resolve(__dirname, "../../public"),
  plugins: [react(), tailwindcss()],
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
  build: {
    outDir: "dist",
  },
});

