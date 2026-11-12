import { describe, expect, it, vi } from "vitest";
import { FakeTransport } from "../hid/fake";
import { K86Session, UnsupportedDeviceError } from "./k86-session";

function identifyReply(deviceId: number): Uint8Array {
  const reply = new Uint8Array(64);
  reply[0] = 0x8f;
  reply[1] = deviceId & 0xff;
  reply[2] = (deviceId >> 8) & 0xff;
  reply[3] = (deviceId >> 16) & 0xff;
  reply[4] = (deviceId >> 24) & 0xff;
  return reply;
}

describe("K86Session", () => {
  it.each([
    {
      id: 1168,
      pid: 0x4015,
      family: "yc500",
      recognized: true,
      writesAllowed: true,
      readOnly: false,
    },
    {
      id: 2730,
      pid: 0x5002,
      family: "gen2",
      recognized: true,
      writesAllowed: false,
      readOnly: true,
    },
    {
      id: 4094,
      pid: 0x5056,
      family: "gen2",
      recognized: true,
      writesAllowed: false,
      readOnly: true,
    },
    {
      id: 9999,
      pid: 0x4015,
      family: "yc500",
      recognized: false,
      writesAllowed: false,
      readOnly: true,
    },
  ])(
    "classifies device $id as recognized=$recognized, writesAllowed=$writesAllowed",
    async ({ id, pid, family, recognized, writesAllowed, readOnly }) => {
      const session = await K86Session.open(FakeTransport.withIdentify(id, pid));

      expect(session.recognized).toBe(recognized);
      expect(session.writesAllowed).toBe(writesAllowed);
      expect(session.readOnly).toBe(readOnly);
      expect(session.definition.family).toBe(family);
    },
  );

  it("identifies a known K86", async () => {
    const session = await K86Session.open(FakeTransport.withIdentify(1168, 0x4015));
    expect(session.definition.family).toBe("yc500");
    expect(session.readOnly).toBe(false);
  });
  it("marks an unknown device read-only", async () => {
    const session = await K86Session.open(FakeTransport.withIdentify(9999, 0x4015));
    expect(session.readOnly).toBe(true);
  });
  it("rejects a short identify reply", async () => {
    const t = FakeTransport.withIdentify(1168, 0x4015);
    const original = t.receiveFeatureReport.bind(t);
    t.receiveFeatureReport = async () => new Uint8Array([0x8f]);
    await expect(K86Session.open(t)).rejects.toThrow(/short/i);
    expect(original).toBeTypeOf("function");
  });
  it("exposes the identified device metadata", async () => {
    const session = await K86Session.open(FakeTransport.withIdentify(1168, 0x4015));
    expect(session.deviceId).toBe(1168);
    expect(session.definition).toBeDefined();
    expect(session.definition.id).toBe(1168);
    expect(session.definition.pid).toBe(0x4015);
    expect(session.definition.layout).toBe("ansi");
    expect(session.definition.screen).toEqual({ width: 240, height: 135, slots: 5 });
    expect(session.definition.profiles).toBe(3);
  });
  it("builds a read-only yc500 fallback for an unknown device", async () => {
    const session = await K86Session.open(FakeTransport.withIdentify(9999, 0x4015));
    expect(session.deviceId).toBe(9999);
    expect(session.definition).toEqual({
      id: 9999,
      vid: 0x3151,
      pid: 0x4015,
      family: "yc500",
      name: "Unknown K86",
      layout: "ansi",
      screen: { width: 240, height: 135, slots: 5 },
      profiles: 3,
    });
  });
  it("keeps an unknown device with a different pid read-only", async () => {
    const session = await K86Session.open(FakeTransport.withIdentify(9999, 0x1234));
    expect(session.readOnly).toBe(true);
    expect(session.definition.family).toBe("yc500");
    expect(session.definition.vid).toBe(0x3151);
    expect(session.definition.pid).toBe(0x1234);
  });
  it("rejects a known id whose transport pid does not match", async () => {
    const t = FakeTransport.withIdentify(1168, 0x5002);
    await expect(K86Session.open(t)).rejects.toBeInstanceOf(UnsupportedDeviceError);
  });
  it("explains the pid mismatch in the error message", async () => {
    const t = FakeTransport.withIdentify(1168, 0x5002);
    await expect(K86Session.open(t)).rejects.toThrow(/0x4015.*0x5002/i);
  });
  it("rejects a known id whose transport vid does not match", async () => {
    const t = new FakeTransport(
      { vendorId: 0x1234, productId: 0x4015 },
      identifyReply(1168),
    );
    const error = await K86Session.open(t).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(UnsupportedDeviceError);
    expect((error as Error).message).toMatch(/0x3151.*0x1234/i);
  });
  it("rejects an invalid identify opcode", async () => {
    const t = FakeTransport.withIdentify(1168, 0x4015);
    t.receiveFeatureReport = async () => new Uint8Array(64);
    await expect(K86Session.open(t)).rejects.toThrow(/opcode/i);
  });
  it("uses report 0 for the identify exchange", async () => {
    const t = FakeTransport.withIdentify(1168, 0x4015);
    const sent: Array<{ reportId: number; data: Uint8Array }> = [];
    const received: number[] = [];
    const originalReceive = t.receiveFeatureReport.bind(t);
    t.sendFeatureReport = async (reportId, data) => {
      sent.push({ reportId, data: data.slice() });
    };
    t.receiveFeatureReport = async (reportId) => {
      received.push(reportId);
      return originalReceive(reportId);
    };
    await K86Session.open(t);
    expect(sent).toHaveLength(1);
    expect(sent[0].reportId).toBe(0);
    expect(sent[0].data).toHaveLength(64);
    expect(sent[0].data[0]).toBe(0x8f);
    expect(received).toEqual([0]);
  });
  it("closes the transport", async () => {
    const t = FakeTransport.withIdentify(1168, 0x4015);
    let closes = 0;
    const originalClose = t.close.bind(t);
    t.close = async () => {
      closes += 1;
      await originalClose();
    };
    const session = await K86Session.open(t);
    await session.close();
    expect(closes).toBe(1);
  });
  it("does not close the transport on a successful open", async () => {
    const t = FakeTransport.withIdentify(1168, 0x4015);
    let closes = 0;
    const originalClose = t.close.bind(t);
    t.close = async () => {
      closes += 1;
      await originalClose();
    };
    const session = await K86Session.open(t);
    expect(closes).toBe(0);
    await session.close();
    expect(closes).toBe(1);
  });
  it("closes the transport when the pid does not match", async () => {
    const t = FakeTransport.withIdentify(1168, 0x5002);
    let closes = 0;
    const originalClose = t.close.bind(t);
    t.close = async () => {
      closes += 1;
      await originalClose();
    };
    await expect(K86Session.open(t)).rejects.toBeInstanceOf(UnsupportedDeviceError);
    expect(closes).toBe(1);
  });
  it("closes the transport when opening fails", async () => {
    const t = FakeTransport.withIdentify(1168, 0x4015);
    let closes = 0;
    const originalClose = t.close.bind(t);
    t.receiveFeatureReport = async () => new Uint8Array([0x8f]);
    t.close = async () => {
      closes += 1;
      await originalClose();
    };
    await expect(K86Session.open(t)).rejects.toThrow(/short/i);
    expect(closes).toBe(1);
  });
  it("keeps the identify error when closing the transport also fails", async () => {
    const t = FakeTransport.withIdentify(1168, 0x4015);
    t.receiveFeatureReport = async () => new Uint8Array([0x8f]);
    t.close = async () => {
      throw new Error("close failed");
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await expect(K86Session.open(t)).rejects.toThrow(/short/i);
      expect(warn).toHaveBeenCalledWith(
        "K86Session: falha ao fechar o transporte após erro de identificação.",
        expect.any(Error),
      );
    } finally {
      warn.mockRestore();
    }
  });
});
