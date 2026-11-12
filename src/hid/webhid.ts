/// <reference path="./webhid.d.ts" />
import type { HidDeviceInfo, HidTransport } from "./transport";

const K86_VENDOR_ID = 0x3151;
const K86_VENDOR_USAGE_PAGE = 0xffff;
const K86_VENDOR_USAGE = 0x0002;

const K86_FILTER: HIDDeviceFilter = {
  vendorId: K86_VENDOR_ID,
  usagePage: K86_VENDOR_USAGE_PAGE,
  usage: K86_VENDOR_USAGE,
};

function hasVendorCollection(device: HIDDevice): boolean {
  return device.collections.some(
    (collection) =>
      collection.usagePage === K86_VENDOR_USAGE_PAGE &&
      collection.usage === K86_VENDOR_USAGE,
  );
}

export function isWebHidSupported(): boolean {
  return typeof navigator !== "undefined" && navigator.hid !== undefined;
}

/**
 * Asks the user to pick the K86 vendor-defined HID collection.
 * Must be called from a user gesture (for example, a click handler);
 * the browser rejects the request otherwise.
 */
export async function requestK86Device(): Promise<HIDDevice> {
  if (!isWebHidSupported()) {
    throw new Error(
      "WebHID não está disponível neste navegador. Use Chrome ou Edge atualizado.",
    );
  }

  const devices = await navigator.hid.requestDevice({ filters: [K86_FILTER] });
  const device = devices.find(hasVendorCollection);
  if (!device) {
    throw new Error(
      "Nenhum dispositivo K86 com a coleção HID 0xFFFF/0x0002 foi selecionado.",
    );
  }
  return device;
}

export class WebHidTransport implements HidTransport {
  readonly info: HidDeviceInfo;

  private readonly device: HIDDevice;
  private readonly listeners = new Set<() => void>();
  private closed = false;

  private readonly handleDisconnect = (event: HIDConnectionEvent): void => {
    if (event.device !== this.device) return;
    for (const listener of this.listeners) listener();
  };

  constructor(device: HIDDevice) {
    this.device = device;
    this.info = {
      vendorId: device.vendorId,
      productId: device.productId,
      ...(device.productName ? { productName: device.productName } : {}),
    };
  }

  async sendFeatureReport(reportId: number, data: Uint8Array): Promise<void> {
    await this.device.sendFeatureReport(reportId, data);
  }

  async receiveFeatureReport(reportId: number): Promise<Uint8Array> {
    const view = await this.device.receiveFeatureReport(reportId);
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }

  onDisconnect(listener: () => void): void {
    if (this.closed) return;
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      navigator.hid.addEventListener("disconnect", this.handleDisconnect);
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.listeners.clear();
    if (typeof navigator !== "undefined" && navigator.hid) {
      navigator.hid.removeEventListener("disconnect", this.handleDisconnect);
    }
    await this.device.close();
  }
}

export async function openWebHidTransport(
  device: HIDDevice,
): Promise<WebHidTransport> {
  await device.open();
  return new WebHidTransport(device);
}
