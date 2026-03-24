import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import webExtension, { readJsonFile } from "vite-plugin-web-extension";
import path from "path";
import analyze from "rollup-plugin-analyzer";
import { viteZip } from "vite-plugin-zip-file";
import { fileURLToPath } from "url";
import { env } from "node:process";
const __dirname = path.dirname(fileURLToPath(import.meta.url));


function generateManifest() {
  const manifest = readJsonFile("src/manifest.json");
  const pkg = readJsonFile("package.json");
  return {
    name: pkg.name,
    description: pkg.description,
    version: pkg.version,
    ...manifest,
  };
}

const ReactCompilerConfig = {};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
      },
    }),
    tailwindcss(),
    webExtension({
      manifest: generateManifest,
      additionalInputs: ["src/devtools/panel.html"],
    }),
    viteZip({
      folderPath: path.resolve(__dirname, "dist"),
      outPath: path.resolve(__dirname),
      zipName: "dist.zip",
      enabled: true,
      // enabled: env.NODE_ENV === "production" ? true : false,
    }),
    analyze({
      // highlight the modules with size > 40kb
      filter(moduleObject) {
        return moduleObject.size > 40000;
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
