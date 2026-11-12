import { afterEach, describe, expect, it, vi } from "vitest";
import { WebHidTransport, openWebHidTransport } from "./webhid";

const originalHidDescriptor = Object.getOwnPropertyDescriptor(navigator, "hid");

class FakeHid extends EventTarget {
  emitDisconnect(device: HIDDevice): void {
    const event = new Event("disconnect");
    Object.defineProperty(event, "device", { value: device });
    this.dispatchEvent(event);
  }
}

function setHid(hid: FakeHid): void {
  Object.defineProperty(navigator, "hid", {
    configurable: true,
    value: hid as unknown as HID,
  });
}

function makeDevice() {
  const open = vi.fn(async () => {});
  const close = vi.fn(async () => {});
  const sendFeatureReport = vi.fn(async () => {});
  const receiveFeatureReport = vi.fn(
    async () => new DataView(new ArrayBuffer(0)),
  );

  const device = {
    vendorId: 0x3151,
    productId: 0x4015,
    productName: "K86 fake",
    collections: [],
    open,
    close,
    sendFeatureReport,
    receiveFeatureReport,
  } as unknown as HIDDevice;

  return { device, open, close, sendFeatureReport, receiveFeatureReport };
}

afterEach(() => {
  if (originalHidDescriptor) {
    Object.defineProperty(navigator, "hid", originalHidDescriptor);
  } else {
    delete (navigator as unknown as Record<string, unknown>).hid;
  }
});

describe("WebHidTransport", () => {
  it("opens the device when creating the transport", async () => {
    const { device, open } = makeDevice();

    const transport = await openWebHidTransport(device);

    expect(open).toHaveBeenCalledTimes(1);
    expect(transport.info).toEqual({
      vendorId: 0x3151,
      productId: 0x4015,
      productName: "K86 fake",
    });
  });

  it("sends feature reports with report ID 0", async () => {
    const { device, sendFeatureReport } = makeDevice();
    const transport = new WebHidTransport(device);
    const data = new Uint8Array([0x8f, 0x70]);

    await transport.sendFeatureReport(0, data);

    expect(sendFeatureReport).toHaveBeenCalledWith(0, data);
  });

  it("normalizes a received DataView with a non-zero byteOffset", async () => {
    const { device, receiveFeatureReport } = makeDevice();
    const backing = new Uint8Array([0xaa, 0xbb, 1, 2, 3, 0xcc]);
    receiveFeatureReport.mockResolvedValue(new DataView(backing.buffer, 2, 3));
    const transport = new WebHidTransport(device);

    const result = await transport.receiveFeatureReport(0);

    expect(receiveFeatureReport).toHaveBeenCalledWith(0);
    expect(Array.from(result)).toEqual([1, 2, 3]);
  });

  it("notifies listeners only for the matching device disconnect", () => {
    const hid = new FakeHid();
    setHid(hid);
    const { device } = makeDevice();
    const other = makeDevice();
    const transport = new WebHidTransport(device);
    const listener = vi.fn();
    transport.onDisconnect(listener);

    hid.emitDisconnect(other.device);
    expect(listener).not.toHaveBeenCalled();

    hid.emitDisconnect(device);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("closes the underlying device only once", async () => {
    const { device, close } = makeDevice();
    const transport = new WebHidTransport(device);

    await Promise.all([transport.close(), transport.close()]);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("removes the navigator disconnect listener on close", async () => {
    const hid = new FakeHid();
    setHid(hid);
    const removeListener = vi.spyOn(hid, "removeEventListener");
    const { device } = makeDevice();
    const transport = new WebHidTransport(device);
    const listener = vi.fn();
    transport.onDisconnect(listener);

    await transport.close();

    expect(removeListener).toHaveBeenCalledWith(
      "disconnect",
      expect.any(Function),
    );

    hid.emitDisconnect(device);
    expect(listener).not.toHaveBeenCalled();
  });
});
