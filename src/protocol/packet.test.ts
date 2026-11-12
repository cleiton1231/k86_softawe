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
  it("throws when the payload exceeds the report body", () => {
    expect(() => buildPacket(0x8f, new Uint8Array(REPORT_LEN))).toThrow(
      "buildPacket: payload too long (max 63 bytes, got 64)",
    );
  });
});
