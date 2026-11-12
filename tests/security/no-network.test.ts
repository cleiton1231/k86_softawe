// @vitest-environment node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// This raw-text scan is a heuristic: the production CSP (`connect-src 'none'`)
// is the runtime backstop against network access.
const forbidden = [/\bfetch\s*\(/, /XMLHttpRequest/, /\bWebSocket\b/, /sendBeacon/];
const sourceExtensions = /\.(?:js|jsx|mjs|cjs|ts|tsx)$/;
const scanRoot = fileURLToPath(new URL("../../src", import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("no network in app code", () => {
  it("does not contain forbidden network APIs", () => {
    const sources = files(scanRoot).filter((p) => sourceExtensions.test(p));

    // Guard against a wrong scan root or an empty tree passing vacuously.
    expect(sources.length).toBeGreaterThanOrEqual(20);

    const productionSources = sources.filter((p) => !p.includes(".test.") && !p.includes(".spec."));

    // The repository currently has 17 production source files.
    expect(productionSources.length).toBeGreaterThanOrEqual(15);

    const hits = productionSources.flatMap((p) =>
      forbidden.filter((r) => r.test(readFileSync(p, "utf8"))).map((r) => `${p}: ${r}`),
    );
    expect(hits).toEqual([]);
  });
});
