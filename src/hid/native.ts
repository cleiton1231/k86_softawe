import type { HidDeviceInfo, HidTransport } from "./transport";

export function hasNativeHid(): boolean {
  return typeof window !== "undefined" && Boolean(window.k86Native);
}

/**
 * Electron bridge to node-hid. Feature reports are sent in the Electron main
 * process so the renderer does not hold the HID handle. Screen packet batches
 * use the same bridge and are paced by the native process.
 */
export class NativeHidTransport implements HidTransport {
  readonly info: HidDeviceInfo;
  private readonly disconnectListeners = new Set<() => void>();
  private readonly unsubscribeDisconnect: () => void;

  private constructor(info: HidDeviceInfo) {
    this.info = info;
    this.unsubscribeDisconnect =
      window.k86Native?.onHidDisconnect(() => {
        for (const listener of this.disconnectListeners) {
          try {
            listener();
          } catch (error) {
            console.warn("K86 Studio: erro em listener de desconexão nativa.", error);
          }
        }
      }) ?? (() => {});
  }

  static async open(): Promise<NativeHidTransport> {
    const api = window.k86Native;
    if (!api) throw new Error("bridge nativo indisponível");
    const info = await api.openHid();
    return new NativeHidTransport(info);
  }

  async sendFeatureReport(_reportId: number, data: Uint8Array): Promise<void> {
    const api = window.k86Native;
    if (!api) throw new Error("bridge nativo indisponível");
    await api.sendFeature(data);
  }

  async receiveFeatureReport(_reportId: number): Promise<Uint8Array> {
    const api = window.k86Native;
    if (!api) throw new Error("bridge nativo indisponível");
    return Uint8Array.from(await api.receiveFeature());
  }

  onDisconnect(listener: () => void): void {
    this.disconnectListeners.add(listener);
  }

  async sendScreenPackets(
    packets: Uint8Array[],
    onProgress?: (sent: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const api = window.k86Native;
    if (!api) throw new Error("bridge nativo indisponível");
    const total = packets.length * 64;
    const data = new Uint8Array(total);
    for (let i = 0; i < packets.length; i++) {
      data.set(packets[i], i * 64);
    }
    const unsubscribe = onProgress
      ? api.onScreenProgress((progress) => onProgress(progress.sent, progress.total))
      : undefined;
    const abort = () => api.cancelScreen();
    signal?.addEventListener("abort", abort);
    try {
      if (signal?.aborted) {
        api.cancelScreen();
        throw Object.assign(new Error("transferência cancelada"), {
          name: "AbortError",
        });
      }
      await api.sendScreenPackets(data, packets.length);
    } finally {
      signal?.removeEventListener("abort", abort);
      unsubscribe?.();
    }
  }

  async close(): Promise<void> {
    this.unsubscribeDisconnect();
    this.disconnectListeners.clear();
    await window.k86Native?.closeHid();
  }
}
