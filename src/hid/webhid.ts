import type { HidDeviceInfo, HidTransport } from "./transport";

const K86_VENDOR_ID = 0x3151;
const VENDOR_USAGE_PAGE = 0xffff;
const VENDOR_USAGE = 0x0002;
const FALLBACK_USAGE_PAGE = 0x0001;
const FALLBACK_USAGE = 0x0002;

const K86_FILTER: HIDDeviceFilter = {
  vendorId: K86_VENDOR_ID,
  usagePage: VENDOR_USAGE_PAGE,
  usage: VENDOR_USAGE,
};

function hasCollection(
  device: HIDDevice,
  usagePage: number,
  usage: number,
): boolean {
  return (
    device.collections?.some(
      (collection) =>
        collection.usagePage === usagePage && collection.usage === usage,
    ) ?? false
  );
}

export function isWebHidSupported(): boolean {
  return typeof navigator !== "undefined" && navigator.hid !== undefined;
}

/**
 * Asks the user to pick the K86 HID collection.
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
  if (devices.length === 0) {
    throw new Error("Seleção cancelada: nenhum dispositivo foi escolhido.");
  }

  const vendorDevice = devices.find((device) =>
    hasCollection(device, VENDOR_USAGE_PAGE, VENDOR_USAGE),
  );
  if (vendorDevice) return vendorDevice;

  // The generic 0x0001/0x0002 collection is only acceptable for read-only
  // identification in this phase. Write features must require the vendor
  // 0xFFFF/0x0002 collection, which is the settings interface.
  const fallbackDevice = devices.find((device) =>
    hasCollection(device, FALLBACK_USAGE_PAGE, FALLBACK_USAGE),
  );
  if (fallbackDevice) {
    console.info(
      "WebHID: usando a coleção de fallback 0x0001/0x0002; somente identificação em modo somente leitura.",
    );
    return fallbackDevice;
  }

  throw new Error(
    "O dispositivo selecionado não expõe a coleção HID 0xFFFF/0x0002 nem a coleção de fallback 0x0001/0x0002.",
  );
}

export class WebHidTransport implements HidTransport {
  readonly info: HidDeviceInfo;

  private readonly device: HIDDevice;
  private readonly listeners = new Set<() => void>();
  private closed = false;
  private watchingDisconnect = false;
  private closePromise: Promise<void> | undefined;

  private readonly handleDisconnect = (event: HIDConnectionEvent): void => {
    if (event.device !== this.device) return;
    const listeners = [...this.listeners];
    this.closed = true;
    this.listeners.clear();
    this.detachDisconnectListener();
    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        console.error("WebHID: listener de desconexão falhou.", error);
      }
    }
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
    this.attachDisconnectListener();
  }

  close(): Promise<void> {
    if (!this.closePromise) {
      this.closePromise = this.finishClose();
    }
    return this.closePromise;
  }

  private attachDisconnectListener(): void {
    if (this.watchingDisconnect) return;
    if (typeof navigator === "undefined" || !navigator.hid) return;
    navigator.hid.addEventListener("disconnect", this.handleDisconnect);
    this.watchingDisconnect = true;
  }

  private detachDisconnectListener(): void {
    if (!this.watchingDisconnect) return;
    this.watchingDisconnect = false;
    if (typeof navigator !== "undefined" && navigator.hid) {
      navigator.hid.removeEventListener("disconnect", this.handleDisconnect);
    }
  }

  private async finishClose(): Promise<void> {
    this.closed = true;
    this.listeners.clear();
    this.detachDisconnectListener();
    try {
      await this.device.close();
    } catch (error) {
      console.warn(
        "WebHID: falha ao fechar o dispositivo; a conexão será considerada encerrada.",
        error,
      );
    }
  }
}

export async function openWebHidTransport(
  device: HIDDevice,
): Promise<WebHidTransport> {
  await device.open();
  return new WebHidTransport(device);
}
