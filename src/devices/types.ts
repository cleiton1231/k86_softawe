export type ProtocolFamily = "yc500" | "gen2";
export type PhysicalLayout = "ansi" | "iso" | "abnt2";

export interface ScreenSpec {
  width: number;
  height: number;
  slots: number;
}

export interface DeviceDefinition {
  id: number;
  vid: number;
  pid: number;
  family: ProtocolFamily;
  name: string;
  layout: PhysicalLayout;
  screen: ScreenSpec;
  profiles: number;
}
