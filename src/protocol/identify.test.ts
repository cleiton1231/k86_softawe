import { describe, expect, it } from "vitest";
import { decodeIdentify, identifyPacket } from "./identify";

describe("identify", () => {
  it("builds the exact 64-byte 0x8F request", () => {
    const packet = identifyPacket();
    expect(packet).toHaveLength(64);
    expect(packet[0]).toBe(0x8f);
    expect(packet[7]).toBe(0x70);
    expect(Array.from(packet.slice(8))).toEqual(new Array(56).fill(0));
  });
  it("decodes 1168 as u32 LE", () => {
    const reply = new Uint8Array(64);
    reply[0] = 0x8f;
    reply[1] = 0x90;
    reply[2] = 0x04;
    expect(decodeIdentify(reply).deviceId).toBe(1168);
  });
  it("rejects a short reply", () => {
    expect(() => decodeIdentify(new Uint8Array([0x8f, 0x90]))).toThrow(/short/i);
  });
  it("rejects a reply with the wrong opcode", () => {
    const reply = new Uint8Array(64);
    reply[0] = 0x00;
    expect(() => decodeIdentify(reply)).toThrow(/opcode/i);
  });
});
