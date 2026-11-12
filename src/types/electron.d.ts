export {};

declare global {
  interface K86NativeHidInfo {
    vendorId: number;
    productId: number;
    productName?: string;
  }

  interface K86NativeScreenProgress {
    sent: number;
    total: number;
  }

  interface K86NativeApi {
    openHid(): Promise<K86NativeHidInfo>;
    closeHid(): Promise<void>;
    sendFeature(data: Uint8Array): Promise<void>;
    receiveFeature(): Promise<number[]>;
    sendScreenPackets(data: Uint8Array, packetCount: number): Promise<void>;
    cancelScreen(): void;
    onScreenProgress(
      callback: (progress: K86NativeScreenProgress) => void,
    ): () => void;
    onHidDisconnect(callback: () => void): () => void;
  }

  interface Window {
    k86Native?: K86NativeApi;
  }
}
