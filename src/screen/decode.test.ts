import { describe, expect, it } from "vitest";
import { clampDelayMs, fitToScreen } from "./decode";

describe("fitToScreen", () => {
  it("keeps an exact 16:9 source unchanged", () => {
    expect(fitToScreen({ width: 480, height: 270 })).toEqual({
      sx: 0,
      sy: 0,
      sw: 480,
      sh: 270,
    });
  });

  it("crops a square source vertically", () => {
    const f = fitToScreen({ width: 100, height: 100 });
    expect(f.sx).toBe(0);
    expect(f.sy).toBeCloseTo(21.875);
    expect(f.sw).toBe(100);
    expect(f.sh).toBeCloseTo(56.25);
  });

  it("crops a wide source horizontally", () => {
    const f = fitToScreen({ width: 1000, height: 100 });
    expect(f.sx).toBeCloseTo(411.111111, 3);
    expect(f.sy).toBe(0);
    expect(f.sw).toBeCloseTo(177.777778, 3);
    expect(f.sh).toBe(100);
  });

  it("handles a 1x1 source", () => {
    const f = fitToScreen({ width: 1, height: 1 });
    expect(f.sx).toBe(0);
    expect(f.sy).toBeCloseTo(0.21875);
    expect(f.sw).toBe(1);
    expect(f.sh).toBeCloseTo(0.5625);
  });
});

describe("clampDelayMs", () => {
  it("clamps to the protocol's 8-bit delay range", () => {
    expect(clampDelayMs(0)).toBe(10);
    expect(clampDelayMs(50)).toBe(50);
    expect(clampDelayMs(999)).toBe(255);
    expect(clampDelayMs(Number.NaN)).toBe(50);
  });
});
