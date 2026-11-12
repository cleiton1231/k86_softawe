import { describe, expect, it } from "vitest";
import { FakeTransport } from "../hid/fake";
import { K86Session, UnsupportedDeviceError } from "./k86-session";

describe("K86Session", () => {
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
  it("rejects a known id whose transport pid does not match", async () => {
    const t = FakeTransport.withIdentify(1168, 0x5002);
    await expect(K86Session.open(t)).rejects.toBeInstanceOf(UnsupportedDeviceError);
  });
  it("explains the pid mismatch in the error message", async () => {
    const t = FakeTransport.withIdentify(1168, 0x5002);
    await expect(K86Session.open(t)).rejects.toThrow(/0x4015.*0x5002/i);
  });
  it("rejects an invalid identify opcode", async () => {
    const t = FakeTransport.withIdentify(1168, 0x4015);
    t.receiveFeatureReport = async () => new Uint8Array(64);
    await expect(K86Session.open(t)).rejects.toThrow(/opcode/i);
  });
  it("sends the identify packet on report 0", async () => {
    const t = FakeTransport.withIdentify(1168, 0x4015);
    const sent: Array<{ reportId: number; data: Uint8Array }> = [];
    t.sendFeatureReport = async (reportId, data) => {
      sent.push({ reportId, data: data.slice() });
    };
    await K86Session.open(t);
    expect(sent).toHaveLength(1);
    expect(sent[0].reportId).toBe(0);
    expect(sent[0].data).toHaveLength(64);
    expect(sent[0].data[0]).toBe(0x8f);
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
});
