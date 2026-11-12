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
  const index = mode === "bit7" ? 7 : 8;
  const required = index + 1;
  if (bytes.length < required) {
    throw new Error(
      `applyChecksum: buffer too short for ${mode} (need at least ${required} bytes, got ${bytes.length})`,
    );
  }
  bytes[index] = checksum(bytes, mode);
  return bytes;
}
