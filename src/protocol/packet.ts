import { applyChecksum, type ChecksumMode } from "./checksum";

export const REPORT_LEN = 64;
const MAX_PAYLOAD_LEN = REPORT_LEN - 1;

export function buildPacket(
  opcode: number,
  payload: ArrayLike<number> = [],
  mode: ChecksumMode = "bit7",
): Uint8Array {
  if (payload.length > MAX_PAYLOAD_LEN) {
    throw new Error(
      `buildPacket: payload too long (max ${MAX_PAYLOAD_LEN} bytes, got ${payload.length})`,
    );
  }
  const buf = new Uint8Array(REPORT_LEN);
  buf[0] = opcode & 0xff;
  for (let i = 0; i < payload.length; i++) {
    buf[i + 1] = payload[i] & 0xff;
  }
  return applyChecksum(buf, mode);
}
