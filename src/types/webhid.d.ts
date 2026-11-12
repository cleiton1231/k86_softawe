// Minimal WebHID declarations for the subset used by K86 Studio.
// TypeScript's DOM lib does not include WebHID (checked with TypeScript 5.9.3),
// so these declarations are local to the app instead of a new dependency.

interface HIDCollectionInfo {
  readonly usagePage: number;
  readonly usage: number;
}

interface HIDDevice {
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  readonly collections: HIDCollectionInfo[];
  readonly opened: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  // WebIDL declares BufferSource; K86 Studio only sends Uint8Array reports.
  sendFeatureReport(reportId: number, data: Uint8Array): Promise<void>;
  receiveFeatureReport(reportId: number): Promise<DataView>;
}

interface HIDDeviceFilter {
  vendorId?: number;
  productId?: number;
  usagePage?: number;
  usage?: number;
}

interface HIDDeviceRequestOptions {
  filters: HIDDeviceFilter[];
}

interface HIDConnectionEvent extends Event {
  readonly device: HIDDevice;
}

interface HID extends EventTarget {
  requestDevice(options: HIDDeviceRequestOptions): Promise<HIDDevice[]>;
  addEventListener(
    type: "disconnect",
    listener: (event: HIDConnectionEvent) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: "disconnect",
    listener: (event: HIDConnectionEvent) => void,
    options?: boolean | EventListenerOptions,
  ): void;
}

interface Navigator {
  readonly hid: HID;
}
