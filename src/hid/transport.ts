export interface HidDeviceInfo {
  vendorId: number;
  productId: number;
  productName?: string;
  path?: string;
}

export interface HidTransport {
  readonly info: HidDeviceInfo;
  sendFeatureReport(reportId: number, data: Uint8Array): Promise<void>;
  receiveFeatureReport(reportId: number): Promise<Uint8Array>;
  /**
   * Registers a listener for device-initiated disconnects, such as a USB
   * unplug. Callers must not rely on `close()` firing this listener, since
   * `close()` is caller-initiated teardown.
   */
  onDisconnect(listener: () => void): void;
  /** Caller-initiated teardown. */
  close(): Promise<void>;
  /**
   * Optional fast path for a whole screen transfer. Native transports send
   * the packet batch in one IPC call; WebHID falls back to per-page reports.
   */
  sendScreenPackets?(
    packets: Uint8Array[],
    onProgress?: (sent: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<void>;
}
