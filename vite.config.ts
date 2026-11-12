import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { CONTENT_SECURITY_POLICY } from "./src/security/csp";

export default defineConfig({
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
