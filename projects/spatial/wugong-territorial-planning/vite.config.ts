import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { extname, resolve } from "node:path";
import { readFileSync } from "node:fs";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "inline-public-data",
      transformIndexHtml(html) {
        const publicDir = resolve(__dirname, "public");
        const data: Record<string, string> = {};

        function readDir(dir: string, prefix: string) {
          const { readdirSync } = require("node:fs");
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const fp = resolve(dir, entry.name);
            if (entry.isDirectory()) { readDir(fp, prefix + entry.name + "/"); }
            else if ([".json", ".geojson", ".csv"].includes(extname(entry.name).toLowerCase())) {
              // Inline structured text only. Binary textures remain public assets.
              data[prefix + entry.name] = readFileSync(fp, "utf-8");
            }
          }
        }
        try { readDir(resolve(publicDir, "data"), "data/"); } catch {}
        try { readDir(resolve(publicDir, "styles"), "styles/"); } catch {}
        try { readDir(resolve(publicDir, "textures"), "textures/"); } catch {}

        // Escape every opening angle bracket so data cannot terminate the script.
        const json = JSON.stringify(data).replace(/</g, "\\u003c");
        return html.replace("</head>", `<script>window.__PUBLIC_DATA__=${json};</script></head>`);
      },
    },
    viteSingleFile({
      removeViteModuleLoader: true,
      inlinePattern: ["**/*.css", "**/*.js"],
    }),
  ],
  base: "/sc-datav/",
  resolve: {
    alias: { "@": resolve("src"), "@data": resolve("public/data"), "@styles": resolve("public/styles"), "@textures": resolve("public/textures") },
  },
  build: {
    target: "esnext",
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
  },
});
