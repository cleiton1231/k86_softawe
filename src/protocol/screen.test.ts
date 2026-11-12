import { describe, expect, it } from "vitest";
import {
  SCREEN_HEIGHT,
  SCREEN_PAGE_DATA,
  SCREEN_WIDTH,
  encodeScreenPixels,
  maxScreenFrames,
  rgbTo565,
  screenAnnouncePacket,
  screenPagePackets,
} from "./screen";

describe("rgbTo565", () => {
  it("encodes red, green and blue as big-endian RGB565", () => {
    expect(rgbTo565(255, 0, 0)).toEqual([0xf8, 0x00]);
    expect(rgbTo565(0, 255, 0)).toEqual([0x07, 0xe0]);
    expect(rgbTo565(0, 0, 255)).toEqual([0x00, 0x1f]);
  });
});

describe("encodeScreenPixels", () => {
  it("writes pixels in column-major order", () => {
    const rgba = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 255,
    ]);
    const out = encodeScreenPixels(rgba, 2, 2);
    expect([...out]).toEqual([
      0xf8, 0x00,
      0x00, 0x1f,
      0x07, 0xe0,
      0xff, 0xff,
    ]);
  });

  it("rejects an RGBA buffer with the wrong size", () => {
    expect(() => encodeScreenPixels(new Uint8ClampedArray(3), 2, 2)).toThrow(/expected/i);
  });
});

describe("screenAnnouncePacket", () => {
  it("builds the 0xA5 announce with frame metadata, bbox and slot", () => {
    const length = SCREEN_WIDTH * SCREEN_HEIGHT * 2;
    const p = screenAnnouncePacket({
      frame: 0,
      frameCount: 1,
      delayMs: 50,
      length,
      bbox: { left: 0, top: 0, right: SCREEN_WIDTH, bottom: SCREEN_HEIGHT },
      slot: 2,
    });
    expect(p).toHaveLength(64);
    expect(p[0]).toBe(0xa5);
    expect(p[1]).toBe(0);
    expect(p[2]).toBe(1);
    expect(p[3]).toBe(50);
    expect(p[4]).toBe(length & 0xff);
    expect(p[5]).toBe((length >> 8) & 0xff);
    expect(p[6]).toBe(0);
    expect(p[7]).toBe(0x0a);
    expect([...p.slice(8, 12)]).toEqual([0, 0, SCREEN_WIDTH, SCREEN_HEIGHT]);
    expect([...p.slice(12, 16)]).toEqual([0, 0, 0, 0]);
    expect(p[16]).toBe((length >> 16) & 0xff);
    expect(p[17]).toBe((length >> 24) & 0xff);
    expect(p[18]).toBe(2);
  });

  it("rejects an invalid slot", () => {
    expect(() =>
      screenAnnouncePacket({
        frame: 0,
        frameCount: 1,
        delayMs: 0,
        length: 1,
        bbox: { left: 0, top: 0, right: 1, bottom: 1 },
        slot: 5,
      }),
    ).toThrow(/slot/i);
  });
});

describe("screenPagePackets", () => {
  it("splits data into 56-byte pages with the 0x25 header", () => {
    const data = new Uint8Array(120).map((_, i) => i & 0xff);
    const packets = screenPagePackets({ frame: 1, frameCount: 3, delayMs: 100, data });
    expect(packets).toHaveLength(3);

    expect(packets[0][0]).toBe(0x25);
    expect(packets[0][1]).toBe(1);
    expect(packets[0][2]).toBe(3);
    expect(packets[0][3]).toBe(100);
    expect(packets[0][4]).toBe(0);
    expect(packets[0][5]).toBe(0);
    expect(packets[0][6]).toBe(SCREEN_PAGE_DATA);
    expect(packets[0][7]).toBe(0x3a);
    expect([...packets[0].slice(8, 64)]).toEqual([...data.slice(0, 56)]);

    expect(packets[2][4]).toBe(2);
    expect(packets[2][6]).toBe(8);
    expect([...packets[2].slice(8, 16)]).toEqual([...data.slice(112, 120)]);
    expect([...packets[2].slice(16, 64)]).toEqual(new Array(48).fill(0));
  });

  it("returns one page for exactly 56 bytes", () => {
    const packets = screenPagePackets({
      frame: 0,
      frameCount: 1,
      delayMs: 0,
      data: new Uint8Array(56).fill(0xaa),
    });
    expect(packets).toHaveLength(1);
    expect(packets[0][6]).toBe(56);
  });
});

describe("maxScreenFrames", () => {
  it("uses the 7 MiB screen budget and caps at 255", () => {
    expect(maxScreenFrames()).toBe(106);
    expect(maxScreenFrames(4 * 1024)).toBe(1);
  });
});
