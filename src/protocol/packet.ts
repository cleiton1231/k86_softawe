import { applyChecksum, type ChecksumMode } from "./checksum";

export const REPORT_LEN = 64;

export function buildPacket(
  opcode: number,
  payload: ArrayLike<number> = [],
  mode: ChecksumMode = "bit7",
): Uint8Array {
  const buf = new Uint8Array(REPORT_LEN);
  buf[0] = opcode & 0xff;
  for (let i = 0; i < payload.length && i + 1 < REPORT_LEN; i++) {
    buf[i + 1] = payload[i] & 0xff;
  }
  return applyChecksum(buf, mode);
}
