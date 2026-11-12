import { applyChecksum, type ChecksumMode } from "./checksum";

export const REPORT_LEN = 64;

function maxPayloadLength(mode: ChecksumMode): number {
  if (mode === "none") return REPORT_LEN - 1;
  const checksumIndex = mode === "bit7" ? 7 : 8;
  return checksumIndex - 1;
}

export function buildPacket(
  opcode: number,
  payload: ArrayLike<number> = [],
  mode: ChecksumMode = "bit7",
): Uint8Array {
  const maxPayload = maxPayloadLength(mode);
  if (payload.length > maxPayload) {
    throw new Error(
      `buildPacket: payload overlaps the ${mode} checksum (max ${maxPayload} bytes, got ${payload.length})`,
    );
  }
  const buf = new Uint8Array(REPORT_LEN);
  buf[0] = opcode & 0xff;
  for (let i = 0; i < payload.length; i++) {
    buf[i + 1] = payload[i] & 0xff;
  }
  return applyChecksum(buf, mode);
}
