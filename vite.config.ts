import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const csp = "default-src 'self'; connect-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'";

export default defineConfig({
  plugins: [react(), {
    name: "k86-csp",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace("</head>", `<meta http-equiv="Content-Security-Policy" content="${csp}"></head>`);
    },
  }],
});
