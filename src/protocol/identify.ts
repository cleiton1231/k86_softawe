import { buildPacket } from "./packet";

export interface IdentifyResult {
  opcode: number;
  deviceId: number;
  raw: Uint8Array;
}

export function identifyPacket(): Uint8Array {
  return buildPacket(0x8f);
}

export function decodeIdentify(reply: Uint8Array): IdentifyResult {
  if (reply.length < 5) throw new Error("identify reply too short");
  if (reply[0] !== 0x8f) throw new Error("unexpected identify opcode");
  const deviceId = reply[1] | (reply[2] << 8) | (reply[3] << 16) | (reply[4] << 24);
  return { opcode: reply[0], deviceId: deviceId >>> 0, raw: reply.slice() };
}
