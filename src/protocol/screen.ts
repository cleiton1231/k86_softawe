import { buildPacket } from "./packet";

export const SCREEN_WIDTH = 240;
export const SCREEN_HEIGHT = 135;
export const SCREEN_PAGE_DATA = 56;
export const SCREEN_SLOTS = 5;
export const SCREEN_FRAME_BYTES = SCREEN_WIDTH * SCREEN_HEIGHT * 2;
export const DEFAULT_SCREEN_MEMORY_BYTES = 7 * 1024 * 1024;

export interface ScreenBoundingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ScreenAnnounceArgs {
  frame: number;
  frameCount: number;
  delayMs: number;
  length: number;
  bbox: ScreenBoundingBox;
  slot: number;
}

export interface ScreenPageArgs {
  frame: number;
  frameCount: number;
  delayMs: number;
  data: Uint8Array;
}

function byte(value: number): number {
  return value & 0xff;
}

function validateByte(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`${name} must be an integer between 0 and 255, got ${value}`);
  }
}

export function rgbTo565(r: number, g: number, b: number): [number, number] {
  const value = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
  return [(value >> 8) & 0xff, value & 0xff];
}

/**
 * Converts RGBA pixels to the display's RGB565 byte order.
 * The vendor sorts by x and then y, so the output is column-major.
 */
export function encodeScreenPixels(
  rgba: Uint8ClampedArray,
  width = SCREEN_WIDTH,
  height = SCREEN_HEIGHT,
): Uint8Array {
  const expected = width * height * 4;
  if (rgba.length !== expected) {
    throw new Error(`expected ${expected} RGBA bytes for ${width}x${height}, got ${rgba.length}`);
  }
  const out = new Uint8Array(width * height * 2);
  let o = 0;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      const [hi, lo] = rgbTo565(rgba[i], rgba[i + 1], rgba[i + 2]);
      out[o++] = hi;
      out[o++] = lo;
    }
  }
  return out;
}

/**
 * 0xA5 announce: frame in [1], count in [2], delay in [3], length in [4..6],
 * bbox low in [8..11], bbox high in [12..15], length high in [16..17],
 * slot in [18]. Bit7 checksum at byte 7.
 */
export function screenAnnouncePacket(args: ScreenAnnounceArgs): Uint8Array {
  if (!Number.isInteger(args.slot) || args.slot < 0 || args.slot >= SCREEN_SLOTS) {
    throw new Error(`slot must be between 0 and ${SCREEN_SLOTS - 1}, got ${args.slot}`);
  }
  if (args.length < 0 || args.length > 0xffffffff) {
    throw new Error(`invalid screen payload length: ${args.length}`);
  }
  validateByte("frame", args.frame);
  validateByte("frameCount", args.frameCount);
  validateByte("delayMs", args.delayMs);
  for (const [name, value] of Object.entries(args.bbox)) {
    if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
      throw new Error(`bbox.${name} must be an integer between 0 and 65535, got ${value}`);
    }
  }

  const p = buildPacket(
    0xa5,
    [
      args.frame,
      args.frameCount,
      args.delayMs,
      args.length & 0xff,
      (args.length >> 8) & 0xff,
      0,
    ],
    "bit7",
  );

  p[8] = byte(args.bbox.left);
  p[9] = byte(args.bbox.top);
  p[10] = byte(args.bbox.right);
  p[11] = byte(args.bbox.bottom);
  p[12] = byte(args.bbox.left >> 8);
  p[13] = byte(args.bbox.top >> 8);
  p[14] = byte(args.bbox.right >> 8);
  p[15] = byte(args.bbox.bottom >> 8);
  p[16] = byte(args.length >> 16);
  p[17] = byte(args.length >> 24);
  p[18] = args.slot;
  return p;
}

/**
 * 0x25 data pages: frame [1], count [2], delay [3], page [4..5],
 * chunk length [6], data at [8..63]. Bit7 checksum at byte 7.
 */
export function screenPagePackets(args: ScreenPageArgs): Uint8Array[] {
  validateByte("frame", args.frame);
  validateByte("frameCount", args.frameCount);
  validateByte("delayMs", args.delayMs);

  const packets: Uint8Array[] = [];
  for (let page = 0; page * SCREEN_PAGE_DATA < args.data.length; page++) {
    const start = page * SCREEN_PAGE_DATA;
    const chunk = args.data.subarray(start, start + SCREEN_PAGE_DATA);
    const p = buildPacket(
      0x25,
      [args.frame, args.frameCount, args.delayMs, page & 0xff, (page >> 8) & 0xff, chunk.length],
      "bit7",
    );
    p.set(chunk, 8);
    packets.push(p);
  }
  return packets;
}

/**
 * Vendor budget: 7 MiB minus 4 KiB of used firmware memory, minus five
 * static image slots, using 4 KiB pages for each frame.
 */
export function maxScreenFrames(memoryBytes = DEFAULT_SCREEN_MEMORY_BYTES): number {
  const used = 4 * 1024;
  const pageSize = 4 * 1024;
  const frameBytes = (Math.floor(SCREEN_FRAME_BYTES / pageSize) + 1) * pageSize;
  const frames = Math.floor((memoryBytes - used) / frameBytes) - SCREEN_SLOTS;
  return Math.max(1, Math.min(255, frames));
}
