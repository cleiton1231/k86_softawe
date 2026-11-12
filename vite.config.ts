import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { CONTENT_SECURITY_POLICY } from "./src/security/csp";

export default defineConfig({
  // Electron loads the production bundle over file://, so asset URLs must be
  // relative to dist/index.html.
  base: "./",
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1",
  },
  plugins: [react(), {
    name: "k86-csp",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: CONTENT_SECURITY_POLICY,
          },
          injectTo: "head-prepend",
        },
      ];
    },
  }],
  build: {
    modulePreload: {
      polyfill: false,
    },
  },
});
