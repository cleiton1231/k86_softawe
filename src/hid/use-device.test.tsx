import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeTransport } from "./fake";
import { useDevice } from "./use-device";

const webhid = vi.hoisted(() => ({
  supported: false,
  requestK86Device: vi.fn(),
  openWebHidTransport: vi.fn(),
}));

vi.mock("./webhid", () => ({
  isWebHidSupported: () => webhid.supported,
  requestK86Device: webhid.requestK86Device,
  openWebHidTransport: webhid.openWebHidTransport,
}));

beforeEach(() => {
  webhid.supported = false;
  webhid.requestK86Device.mockReset();
  webhid.openWebHidTransport.mockReset();
});

describe("useDevice", () => {
  it("offers demo when WebHID is unavailable", async () => {
    const { result } = renderHook(() => useDevice());
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.state.status).toBe("error");
    expect(result.current.state.error).toMatch(/webhid/i);
    expect(result.current.state.error).toMatch(/demo/i);
  });

  it("connects in demo mode", async () => {
    const { result } = renderHook(() => useDevice());
    await act(async () => {
      await result.current.connectDemo();
    });
    expect(result.current.state.status).toBe("connected");
    expect(result.current.state.session?.definition.id).toBe(1168);
    expect(result.current.state.session?.definition.family).toBe("yc500");
  });

  it("connects a WebHID transport and drops the session on disconnect", async () => {
    webhid.supported = true;
    const transport = FakeTransport.withIdentify(1168, 0x4015);
    webhid.requestK86Device.mockResolvedValue({});
    webhid.openWebHidTransport.mockResolvedValue(transport);

    const { result } = renderHook(() => useDevice());
    await act(async () => {
      await result.current.connect();
    });

    expect(webhid.requestK86Device).toHaveBeenCalledTimes(1);
    expect(webhid.openWebHidTransport).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe("connected");
    expect(result.current.state.session?.definition.id).toBe(1168);

    await act(async () => {
      await transport.disconnect();
    });

    expect(result.current.state.status).toBe("disconnected");
    expect(result.current.state.session).toBeUndefined();
    expect(result.current.state.error).toBeUndefined();
  });

  it("reports a chooser error instead of throwing", async () => {
    webhid.supported = true;
    webhid.requestK86Device.mockRejectedValue(
      new Error("Seleção cancelada: nenhum dispositivo foi escolhido."),
    );

    const { result } = renderHook(() => useDevice());
    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.state.status).toBe("error");
    expect(result.current.state.error).toMatch(/seleção cancelada/i);
    expect(webhid.openWebHidTransport).not.toHaveBeenCalled();
  });

  it("closes the session and clears state on disconnect", async () => {
    const { result } = renderHook(() => useDevice());
    await act(async () => {
      await result.current.connectDemo();
    });

    const session = result.current.state.session;
    expect(session).toBeDefined();
    const close = vi.spyOn(session!, "close");

    await act(async () => {
      await result.current.disconnect();
    });

    expect(close).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe("disconnected");
    expect(result.current.state.session).toBeUndefined();
  });
});
