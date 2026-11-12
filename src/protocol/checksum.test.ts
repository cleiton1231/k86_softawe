import { describe, expect, it } from "vitest";
import { checksum } from "./checksum";

describe("checksum", () => {
  it("uses 0xFF minus the sum for bit7", () => {
    expect(checksum(new Uint8Array([0x8f]), "bit7")).toBe(0x70);
  });
  it("covers byte 7 for bit8", () => {
    expect(checksum(new Uint8Array([0x07, 0x01, 0x02]), "bit8")).toBe(0xf5);
  });
  it("returns zero for none", () => {
    expect(checksum(new Uint8Array([0x01, 0x02]), "none")).toBe(0);
  });
});
