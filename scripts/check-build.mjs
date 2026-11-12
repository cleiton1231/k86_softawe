import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve("dist/index.html"), "utf8");
const required = [
  "connect-src &#39;none&#39;",
  "script-src &#39;self&#39;",
  "style-src &#39;self&#39;",
  "base-uri &#39;none&#39;",
  "form-action &#39;none&#39;",
];
const failures = required.filter((token) => !html.includes(token));

if (!/src="\.\/assets\//.test(html)) {
  failures.push('script src relativo (src="./assets/")');
}
if (!/href="\.\/assets\//.test(html)) {
  failures.push('stylesheet href relativo (href="./assets/")');
}

if (failures.length > 0) {
  console.error("Build de produção inválido:");
  for (const failure of failures) console.error(`- falta ${failure}`);
  process.exit(1);
}

console.log("Build de produção OK: CSP e assets relativos conferem.");
