import { describe, expect, it } from "vitest";
import { applyChecksum, checksum } from "./checksum";

describe("checksum", () => {
  it("uses 0xFF minus the sum for bit7", () => {
    expect(checksum(new Uint8Array([0x8f]), "bit7")).toBe(0x70);
  });
  it("covers byte 7 for bit8", () => {
    expect(checksum(new Uint8Array([0x07, 0x01, 0x02]), "bit8")).toBe(0xf5);
  });
  it("includes byte 7 in the bit8 sum", () => {
    expect(checksum(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]), "bit8")).toBe(
      0xfe,
    );
  });
  it("returns zero for none", () => {
    expect(checksum(new Uint8Array([0x01, 0x02]), "none")).toBe(0);
  });
});

describe("applyChecksum", () => {
  it("writes the bit7 checksum at byte 7", () => {
    const buf = new Uint8Array(64);
    buf[0] = 0x8f;
    expect(applyChecksum(buf, "bit7")).toBe(buf);
    expect(buf[7]).toBe(0x70);
  });
  it("writes the bit8 checksum at byte 8", () => {
    const buf = new Uint8Array(64);
    buf[7] = 0x01;
    expect(applyChecksum(buf, "bit8")).toBe(buf);
    expect(buf[8]).toBe(0xfe);
  });
  it("writes nothing for none", () => {
    const buf = new Uint8Array(64);
    buf[7] = 0xaa;
    buf[8] = 0xbb;
    expect(applyChecksum(buf, "none")).toBe(buf);
    expect(buf[7]).toBe(0xaa);
    expect(buf[8]).toBe(0xbb);
  });
  it("throws when a bit7 buffer cannot hold byte 7", () => {
    expect(() => applyChecksum(new Uint8Array(7), "bit7")).toThrow(
      "applyChecksum: buffer too short for bit7 (need at least 8 bytes, got 7)",
    );
  });
  it("throws when a bit8 buffer cannot hold byte 8", () => {
    expect(() => applyChecksum(new Uint8Array(8), "bit8")).toThrow(
      "applyChecksum: buffer too short for bit8 (need at least 9 bytes, got 8)",
    );
  });
});
