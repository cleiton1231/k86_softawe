export type ChecksumMode = "bit7" | "bit8" | "none";

export function checksum(bytes: Uint8Array, mode: ChecksumMode): number {
  if (mode === "none") return 0;
  const end = mode === "bit7" ? 7 : 8;
  let sum = 0;
  for (let i = 0; i < end && i < bytes.length; i++) sum = (sum + bytes[i]) & 0xff;
  return (0xff - sum) & 0xff;
}

export function applyChecksum(bytes: Uint8Array, mode: ChecksumMode): Uint8Array {
  if (mode === "none") return bytes;
  bytes[mode === "bit7" ? 7 : 8] = checksum(bytes, mode);
  return bytes;
}
