// @vitest-environment node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// This raw-text scan is a heuristic: the production CSP (`connect-src 'none'`)
// and the Electron session request filter are the runtime backstops.
const forbidden = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /\bWebSocket\b/,
  /sendBeacon/,
  /\bnet\.request\b/,
  /\bhttps?\.(?:request|get)\b/,
  /\bdns\./,
  /\btls\./,
  /\bdgram\./,
  /\bEventSource\b/,
  /\bWebTransport\b/,
  /\bRTCPeerConnection\b/,
  /import\s*\(\s*["'`]https?:/,
];
const sourceExtensions = /\.(?:js|jsx|mjs|cjs|ts|tsx)$/;
const scanRoots = [
  fileURLToPath(new URL("../../src", import.meta.url)),
  fileURLToPath(new URL("../../electron", import.meta.url)),
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("no network in app code", () => {
  it("does not contain forbidden network APIs", () => {
    const sources = scanRoots.flatMap(files).filter((p) => sourceExtensions.test(p));

    // Guard against a wrong scan root or an empty tree passing vacuously.
    expect(sources.length).toBeGreaterThanOrEqual(20);

    const productionSources = sources.filter((p) => !p.includes(".test.") && !p.includes(".spec."));

    // The repository currently has 17 production source files plus the
    // Electron main/preload/HID bridge.
    expect(productionSources.length).toBeGreaterThanOrEqual(18);

    const hits = productionSources.flatMap((p) =>
      forbidden.filter((r) => r.test(readFileSync(p, "utf8"))).map((r) => `${p}: ${r}`),
    );
    expect(hits).toEqual([]);
  });
});
