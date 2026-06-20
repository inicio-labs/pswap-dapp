import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @miden-sdk/miden-sdk ships a WASM core. It must NOT be pre-bundled by esbuild
// (that mangles the top-level-await WASM init), and the dev server needs the
// cross-origin-isolation headers the WASM/worker layer expects.
export default defineConfig({
  plugins: [react()],
  // The miden-sdk eager entry initializes WASM with top-level await, which needs
  // a modern target in both the dev pre-bundle and the production build.
  optimizeDeps: {
    exclude: ["@miden-sdk/miden-sdk", "@miden-sdk/react"],
    esbuildOptions: { target: "esnext" },
  },
  build: {
    target: "esnext",
  },
  // The miden-sdk WASM core spins up web workers; they must be bundled as ES
  // modules (the default IIFE worker format can't be split into multiple chunks).
  worker: {
    format: "es",
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
