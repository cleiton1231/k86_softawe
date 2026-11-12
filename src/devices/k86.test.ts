import { describe, expect, it } from "vitest";
import { K86_DEVICES, findDeviceById, findDeviceByPid } from "./k86";
import type { DeviceDefinition } from "./types";

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
  it("freezes the registry array and its entries", () => {
    expect(Object.isFrozen(K86_DEVICES)).toBe(true);
    const device = findDeviceById(1168);
    if (!device) throw new Error("expected device 1168 in the registry");
    expect(Object.isFrozen(device)).toBe(true);
    expect(Object.isFrozen(device.screen)).toBe(true);
    expect(() => {
      device.name = "mutated";
    }).toThrow(TypeError);
    expect(device.name).toBe("Attack Shark K86 (1168)");
    expect(() => {
      (K86_DEVICES as DeviceDefinition[]).push(device);
    }).toThrow(TypeError);
    expect(K86_DEVICES).toHaveLength(3);
  });
});
