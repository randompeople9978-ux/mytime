// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Outside a Lovable build, this package would otherwise default to the
  // "cloudflare-module" preset. We pin "node-server" instead so `npm run build`
  // produces a plain Node server (.output/server/index.mjs) that runs on any
  // regular VPS / Pterodactyl node egg via `node .output/server/index.mjs` —
  // no Cloudflare Workers runtime required.
  nitro: {
    preset: "node-server",
  },
});
