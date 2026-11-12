import { describe, expect, it } from "vitest";
import { K86_DEVICES, findDeviceById, findDeviceByPid } from "./k86";

describe("K86 registry", () => {
  it("contains the three known revisions", () => {
    expect(K86_DEVICES.map((d) => d.id)).toEqual([1168, 2730, 4094]);
  });
  it("maps 3151:4015 to yc500", () => {
    const d = findDeviceById(1168);
    expect(d?.pid).toBe(0x4015);
    expect(d?.family).toBe("yc500");
    expect(d?.screen).toEqual({ width: 240, height: 135, slots: 5 });
  });
  it("maps 3151:5002 and 3151:5056 to gen2", () => {
    expect(findDeviceByPid(0x5002)?.family).toBe("gen2");
    expect(findDeviceByPid(0x5056)?.family).toBe("gen2");
  });
  it("returns undefined for unknown ids", () => {
    expect(findDeviceById(9999)).toBeUndefined();
  });
});
