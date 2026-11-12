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
  onDisconnect(listener: () => void): void;
  close(): Promise<void>;
}
