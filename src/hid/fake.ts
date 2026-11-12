import type { HidDeviceInfo, HidTransport } from "./transport";
import { REPORT_LEN } from "../protocol/packet";

export class FakeTransport implements HidTransport {
  readonly info: HidDeviceInfo;
  private reply: Uint8Array;
  private disconnectListeners: Array<() => void> = [];
  private notified = false;

  constructor(info: HidDeviceInfo, reply: Uint8Array) {
    this.info = info;
    this.reply = reply.slice();
  }

  static withIdentify(deviceId: number, pid: number): FakeTransport {
    const reply = new Uint8Array(REPORT_LEN);
    reply[0] = 0x8f;
    reply[1] = deviceId & 0xff;
    reply[2] = (deviceId >> 8) & 0xff;
    reply[3] = (deviceId >> 16) & 0xff;
    reply[4] = (deviceId >> 24) & 0xff;
    return new FakeTransport({ vendorId: 0x3151, productId: pid, productName: "K86 fake" }, reply);
  }

  async sendFeatureReport(_reportId: number, _data: Uint8Array): Promise<void> {}

  async receiveFeatureReport(_reportId: number): Promise<Uint8Array> {
    return this.reply.slice();
  }

  onDisconnect(listener: () => void): void {
    this.disconnectListeners.push(listener);
  }

  async disconnect(): Promise<void> {
    if (this.notified) return;
    this.notified = true;
    for (const listener of this.disconnectListeners) listener();
  }

  async close(): Promise<void> {
    await this.disconnect();
  }
}
