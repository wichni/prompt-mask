import { fileURLToPath } from "node:url";
import { access, readFile } from "node:fs/promises";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const fromRoot = (path) =>
  fileURLToPath(new URL(`../${path}`, import.meta.url));

await build({
  configFile: false,
  root: projectRoot,
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidePanel: fromRoot("side-panel.html"),
      },
    },
  },
});

const buildExtensionScript = async (entry, name, fileName) => {
  await build({
    configFile: false,
    root: projectRoot,
    publicDir: false,
    build: {
      outDir: "dist",
      emptyOutDir: false,
      lib: {
        entry: fromRoot(entry),
        formats: ["iife"],
        name,
        fileName: () => fileName,
      },
    },
  });
};

await buildExtensionScript(
  "src/platform/chromium/service-worker.ts",
  "PromptMaskServiceWorker",
  "service-worker.js",
);
await buildExtensionScript(
  "src/providers/chatgpt/content-script.ts",
  "PromptMaskContentScript",
  "content-script.js",
);

const requiredFiles = [
  "manifest.json",
  "side-panel.html",
  "service-worker.js",
  "content-script.js",
];
await Promise.all(requiredFiles.map((file) => access(fromRoot(`dist/${file}`))));

const manifest = JSON.parse(await readFile(fromRoot("dist/manifest.json"), "utf8"));
if (
  manifest.background?.service_worker !== "service-worker.js" ||
  manifest.content_scripts?.[0]?.js?.[0] !== "content-script.js" ||
  manifest.side_panel?.default_path !== "side-panel.html" ||
  manifest.web_accessible_resources !== undefined
) {
  throw new Error("INVALID_EXTENSION_BUILD_REFERENCES");
}

const contentScript = await readFile(fromRoot("dist/content-script.js"), "utf8");
if (/\bimport\s*(?:[\w*{]|["'])/.test(contentScript)) {
  throw new Error("CONTENT_SCRIPT_MUST_BE_SELF_CONTAINED");
}
