// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { createRequire } from "node:module";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const require = createRequire(import.meta.url);

// Resolve the start-client-core package root once so all three #-imports point
// to real files. Vite's dev server does not follow Node package.json "imports"
// maps in node_modules, so we wire them explicitly as resolve.alias entries.
const startClientCore = path.dirname(
  require.resolve("@tanstack/start-client-core/package.json"),
);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: {
        "#tanstack-start-entry": path.join(startClientCore, "dist/esm/fake-entries/start.js"),
        "#tanstack-router-entry": path.join(startClientCore, "dist/esm/fake-entries/router.js"),
        "#tanstack-start-plugin-adapters": path.join(startClientCore, "dist/esm/fake-entries/plugin-adapters.js"),
      },
    },
  },
});
