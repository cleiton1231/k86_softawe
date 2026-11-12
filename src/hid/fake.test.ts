import { describe, expect, it } from "vitest";
import { FakeTransport } from "./fake";
import { identifyPacket } from "../protocol/identify";

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
});
