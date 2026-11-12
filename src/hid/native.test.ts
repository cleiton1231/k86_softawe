import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasNativeHid, NativeHidTransport } from "./native";

type NativeApi = NonNullable<Window["k86Native"]>;

function installNativeApi(overrides: Partial<NativeApi> = {}): NativeApi {
  const api: NativeApi = {
    openHid: vi.fn(async () => ({
      vendorId: 0x3151,
      productId: 0x4015,
      productName: "Gaming Keyboard",
    })),
    closeHid: vi.fn(async () => {}),
    sendFeature: vi.fn(async () => {}),
    receiveFeature: vi.fn(async () => [0, 0x84, 1]),
    sendScreenPackets: vi.fn(async () => {}),
    cancelScreen: vi.fn(),
    onScreenProgress: vi.fn(() => () => {}),
    onHidDisconnect: vi.fn(() => () => {}),
    ...overrides,
  };

  Object.defineProperty(window, "k86Native", {
    configurable: true,
    value: api,
  });

  return api;
}

function emitProgress(sent: number, total: number) {
  // The installed mock captures the listener in its closure; reaching it
  // through the mock call keeps the test independent of module state.
  const api = window.k86Native!;
  const listener = (api.onScreenProgress as ReturnType<typeof vi.fn>).mock
    .calls[0]?.[0];
  listener?.({ sent, total });
}

function emitDisconnect() {
  const api = window.k86Native!;
  const listener = (api.onHidDisconnect as ReturnType<typeof vi.fn>).mock
    .calls[0]?.[0];
  listener?.();
}

beforeEach(() => {
  delete (window as { k86Native?: NativeApi }).k86Native;
});

afterEach(() => {
  delete (window as { k86Native?: NativeApi }).k86Native;
});

describe("NativeHidTransport", () => {
  it("is unavailable without the Electron preload bridge", () => {
    expect(hasNativeHid()).toBe(false);
  });

  it("opens through the bridge and forwards feature reports", async () => {
    const api = installNativeApi();
    const transport = await NativeHidTransport.open();

    expect(hasNativeHid()).toBe(true);
    expect(transport.info.productId).toBe(0x4015);

    await transport.sendFeatureReport(0, new Uint8Array([0x84, 0x01]));
    expect(api.sendFeature).toHaveBeenCalledWith(new Uint8Array([0x84, 0x01]));

    const reply = await transport.receiveFeatureReport(0);
    expect(Array.from(reply)).toEqual([0, 0x84, 1]);

    await transport.close();
    expect(api.closeHid).toHaveBeenCalled();
  });

  it("packs screen reports into one bridge call and maps progress", async () => {
    const api = installNativeApi();
    const transport = await NativeHidTransport.open();
    const first = new Uint8Array(64).fill(0xa5);
    const second = new Uint8Array(64).fill(0x25);
    const progress = vi.fn();

    const sending = transport.sendScreenPackets([first, second], progress);
    emitProgress(2, 2);
    await sending;

    const [batch, count] = (api.sendScreenPackets as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect(count).toBe(2);
    expect(batch).toHaveLength(128);
    expect(Array.from(batch.slice(0, 64))).toEqual(Array.from(first));
    expect(Array.from(batch.slice(64))).toEqual(Array.from(second));
    expect(progress).toHaveBeenCalledWith(2, 2);
  });

  it("cancels an aborted transfer before invoking the bridge", async () => {
    const api = installNativeApi();
    const transport = await NativeHidTransport.open();
    const controller = new AbortController();
    controller.abort();

    await expect(
      transport.sendScreenPackets(
        [new Uint8Array(64)],
        undefined,
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(api.cancelScreen).toHaveBeenCalled();
    expect(api.sendScreenPackets).not.toHaveBeenCalled();
  });

  it("notifies disconnect listeners registered by the session", async () => {
    installNativeApi();
    const transport = await NativeHidTransport.open();
    const listener = vi.fn();
    transport.onDisconnect(listener);

    emitDisconnect();

    expect(listener).toHaveBeenCalledTimes(1);
    await transport.close();
  });
});
