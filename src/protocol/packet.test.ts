import { describe, expect, it } from "vitest";
import { buildPacket, REPORT_LEN } from "./packet";

describe("buildPacket", () => {
  it("creates a 64-byte report with opcode and checksum at byte 7", () => {
    const p = buildPacket(0x8f);
    expect(p).toHaveLength(REPORT_LEN);
    expect(p[0]).toBe(0x8f);
    expect(p[7]).toBe(0x70);
  });
  it("puts the bit8 checksum at byte 8", () => {
    const p = buildPacket(0x07, [0x01, 0x02], "bit8");
    expect(p[8]).toBe(0xf5);
  });
  it("computes the bit8 checksum over byte 7", () => {
    const p = buildPacket(0x07, [0, 0, 0, 0, 0, 0, 0x01], "bit8");
    expect(p[7]).toBe(0x01);
    expect(p[8]).toBe(0xf7);
  });
  it("does not write a checksum for none", () => {
    const p = buildPacket(0x8f, [], "none");
    expect(p[7]).toBe(0);
  });
  it("accepts the maximum bit7 payload without overwriting it", () => {
    const payload = [1, 2, 3, 4, 5, 6];
    const p = buildPacket(0x8f, payload, "bit7");
    expect(Array.from(p.slice(1, 7))).toEqual(payload);
    expect(p[7]).toBe(0x5b);
  });
  it("rejects a bit7 payload that would overlap the checksum", () => {
    expect(() => buildPacket(0x8f, new Uint8Array(7), "bit7")).toThrow(
      "buildPacket: payload overlaps the bit7 checksum (max 6 bytes, got 7)",
    );
  });
  it("accepts the maximum bit8 payload without overwriting it", () => {
    const payload = [1, 2, 3, 4, 5, 6, 7];
    const p = buildPacket(0x07, payload, "bit8");
    expect(Array.from(p.slice(1, 8))).toEqual(payload);
  });
  it("rejects a bit8 payload that would overlap the checksum", () => {
    expect(() => buildPacket(0x07, new Uint8Array(8), "bit8")).toThrow(
      "buildPacket: payload overlaps the bit8 checksum (max 7 bytes, got 8)",
    );
  });
  it("accepts the full body when there is no checksum", () => {
    const payload = new Uint8Array(REPORT_LEN - 1).fill(0xaa);
    const p = buildPacket(0x8f, payload, "none");
    expect(p).toHaveLength(REPORT_LEN);
    expect(Array.from(p.slice(1))).toEqual(Array.from(payload));
  });
  it("throws when the payload exceeds the report body", () => {
    expect(() => buildPacket(0x8f, new Uint8Array(REPORT_LEN), "none")).toThrow(
      "buildPacket: payload overlaps the none checksum (max 63 bytes, got 64)",
    );
  });
});
