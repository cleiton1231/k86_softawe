import { describe, expect, it } from "vitest";
import { FakeTransport } from "./fake";
import { decodeIdentify, identifyPacket } from "../protocol/identify";

describe("FakeTransport", () => {
  it("returns a canned identify reply", async () => {
    const t = FakeTransport.withIdentify(1168, 0x4015);
    await t.sendFeatureReport(0, identifyPacket());
    const reply = await t.receiveFeatureReport(0);
    expect(reply[0]).toBe(0x8f);
    expect(reply[1] | (reply[2] << 8)).toBe(1168);
  });
  it("reports disconnects to listeners", async () => {
    const t = FakeTransport.withIdentify(1168, 0x4015);
    let called = false;
    t.onDisconnect(() => { called = true; });
    await t.disconnect();
    expect(called).toBe(true);
  });
  it("reports close as a disconnect", async () => {
    const t = FakeTransport.withIdentify(1168, 0x4015);
    let calls = 0;
    t.onDisconnect(() => { calls += 1; });
    await t.close();
    expect(calls).toBe(1);
  });
  it("notifies listeners only once across disconnect and close", async () => {
    const t = FakeTransport.withIdentify(1168, 0x4015);
    let calls = 0;
    t.onDisconnect(() => { calls += 1; });
    await t.disconnect();
    await t.close();
    expect(calls).toBe(1);
  });
  it("encodes the full u32 device id little-endian", async () => {
    const t = FakeTransport.withIdentify(0x12345678, 0x4015);
    const reply = await t.receiveFeatureReport(0);
    expect([...reply.slice(1, 5)]).toEqual([0x78, 0x56, 0x34, 0x12]);
    expect(decodeIdentify(reply).deviceId).toBe(0x12345678);
  });
  it("exposes the device info", () => {
    const t = FakeTransport.withIdentify(1168, 0x4015);
    expect(t.info.vendorId).toBe(0x3151);
    expect(t.info.productId).toBe(0x4015);
  });
  it("copies the canned reply given to the constructor", async () => {
    const reply = new Uint8Array(64);
    reply[0] = 0x8f;
    reply[1] = 0x90;
    const t = new FakeTransport({ vendorId: 0x3151, productId: 0x4015 }, reply);
    reply[1] = 0x00;
    expect((await t.receiveFeatureReport(0))[1]).toBe(0x90);
  });
});
