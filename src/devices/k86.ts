import type { DeviceDefinition } from "./types";

function defineK86Device(device: DeviceDefinition): DeviceDefinition {
  return Object.freeze({
    ...device,
    screen: Object.freeze({ ...device.screen }),
  });
}

export const K86_DEVICES: readonly DeviceDefinition[] = Object.freeze([
  defineK86Device({
    id: 1168,
    vid: 0x3151,
    pid: 0x4015,
    family: "yc500",
    name: "Attack Shark K86 (1168)",
    layout: "ansi",
    screen: { width: 240, height: 135, slots: 5 },
    profiles: 3,
  }),
  defineK86Device({
    id: 2730,
    vid: 0x3151,
    pid: 0x5002,
    family: "gen2",
    name: "Attack Shark K86 (2730)",
    layout: "ansi",
    screen: { width: 240, height: 135, slots: 5 },
    profiles: 3,
  }),
  defineK86Device({
    id: 4094,
    vid: 0x3151,
    pid: 0x5056,
    family: "gen2",
    name: "Attack Shark K86 (4094)",
    layout: "ansi",
    screen: { width: 240, height: 135, slots: 5 },
    profiles: 3,
  }),
]);

export const findDeviceById = (id: number) => K86_DEVICES.find((d) => d.id === id);
export const findDeviceByPid = (pid: number) => K86_DEVICES.find((d) => d.pid === pid);
