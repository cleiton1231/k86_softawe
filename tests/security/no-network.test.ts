import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const forbidden = [/\bfetch\s*\(/, /XMLHttpRequest/, /\bWebSocket\b/, /sendBeacon/];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("no network in app code", () => {
  it("does not contain forbidden network APIs", () => {
    const hits = files("src")
      .filter((p) => /\.(ts|tsx)$/.test(p) && !p.includes(".test."))
      .flatMap((p) => forbidden.filter((r) => r.test(readFileSync(p, "utf8"))).map((r) => `${p}: ${r}`));
    expect(hits).toEqual([]);
  });
});
