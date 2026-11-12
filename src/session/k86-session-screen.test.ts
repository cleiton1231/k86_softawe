import { describe, expect, it } from "vitest";
import type { HidDeviceInfo, HidTransport } from "../hid/transport";
import { REPORT_LEN } from "../protocol/packet";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../protocol/screen";
import type { ScreenAnimation } from "../screen/decode";
import { K86Session, ScreenAckError } from "./k86-session";

class RecordingTransport implements HidTransport {
  readonly info: HidDeviceInfo;
  sent: Uint8Array[] = [];
  replies: Uint8Array[] = [];

  constructor(productId = 0x4015) {
    this.info = { vendorId: 0x3151, productId, productName: "K86 test" };
  }

  async sendFeatureReport(_reportId: number, data: Uint8Array): Promise<void> {
    this.sent.push(data.slice());
  }

  async receiveFeatureReport(_reportId: number): Promise<Uint8Array> {
    return (this.replies.shift() ?? new Uint8Array(REPORT_LEN)).slice();
  }

  onDisconnect(_listener: () => void): void {}

  async close(): Promise<void> {}
}

function identifyReply(deviceId: number): Uint8Array {
  const reply = new Uint8Array(REPORT_LEN);
  reply[0] = 0x8f;
  reply[1] = deviceId & 0xff;
  reply[2] = (deviceId >> 8) & 0xff;
  reply[3] = (deviceId >> 16) & 0xff;
  reply[4] = (deviceId >> 24) & 0xff;
  return reply;
}

function ackReply(): Uint8Array {
  const reply = new Uint8Array(REPORT_LEN);
  reply[0] = 0xa5;
  reply[1] = 1;
  return reply;
}

async function openSession(transport: RecordingTransport): Promise<K86Session> {
  transport.replies.push(identifyReply(transport.info.productId === 0x5002 ? 2730 : 1168));
  const session = await K86Session.open(transport);
  transport.sent = [];
  transport.replies = [];
  return session;
}

function animation(frameCount = 1): ScreenAnimation {
  return {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    delayMs: 50,
    frames: Array.from(
      { length: frameCount },
      () => new Uint8ClampedArray(SCREEN_WIDTH * SCREEN_HEIGHT * 4),
    ),
  };
}

describe("K86Session screen transfer", () => {
  it("sends one announce and all data pages for a still frame", async () => {
    const t = new RecordingTransport();
    const session = await openSession(t);
    t.replies.push(ackReply());

    await session.sendScreenAnimation(animation(), { slot: 2, pageDelayMs: 0, ackDelayMs: 0, ackPollMs: 0 });

    const announces = t.sent.filter((p) => p[0] === 0xa5);
    expect(announces).toHaveLength(1);
    expect(announces[0][1]).toBe(2);
    expect(announces[0][2]).toBe(1);
    expect(announces[0][3]).toBe(0);
    expect(announces[0][18]).toBe(0);

    const pages = t.sent.filter((p) => p[0] === 0x25);
    expect(pages).toHaveLength(Math.ceil((SCREEN_WIDTH * SCREEN_HEIGHT * 2) / 56));
    expect(pages[0][1]).toBe(2);
    expect(pages[0][2]).toBe(1);
    expect(pages[0][3]).toBe(0);
    expect(pages[0][4]).toBe(0);
    expect(pages[pages.length - 1][1]).toBe(2);
  });

  it("sends every frame with frameCount and frame index", async () => {
    const t = new RecordingTransport();
    const session = await openSession(t);
    t.replies.push(ackReply());

    await session.sendScreenAnimation(animation(2), { slot: 0, pageDelayMs: 0, ackDelayMs: 0, ackPollMs: 0 });

    const pages = t.sent.filter((p) => p[0] === 0x25);
    expect(pages).toHaveLength(2 * Math.ceil((SCREEN_WIDTH * SCREEN_HEIGHT * 2) / 56));
    expect(pages.filter((p) => p[1] === 0)[0][2]).toBe(2);
    expect(pages.filter((p) => p[1] === 1)[0][2]).toBe(2);
  });

  it("aborts before sending pages when the announce is not acknowledged", async () => {
    const t = new RecordingTransport();
    const session = await openSession(t);
    t.replies = Array.from({ length: 10 }, () => new Uint8Array([0xa5, 0]));

    await expect(
      session.sendScreenAnimation(animation(), { slot: 0, pageDelayMs: 0, ackDelayMs: 0, ackPollMs: 0 }),
    ).rejects.toBeInstanceOf(ScreenAckError);
    expect(t.sent.every((p) => p[0] === 0xa5)).toBe(true);
  });

  it("rejects an invalid slot before sending", async () => {
    const t = new RecordingTransport();
    const session = await openSession(t);

    await expect(
      session.sendScreenAnimation(animation(), { slot: 5, pageDelayMs: 0, ackDelayMs: 0, ackPollMs: 0 }),
    ).rejects.toThrow(/slot/i);
    expect(t.sent).toEqual([]);
  });

  it("rejects gen2 devices as read-only", async () => {
    const t = new RecordingTransport(0x5002);
    const session = await openSession(t);
    expect(session.writesAllowed).toBe(false);

    await expect(
      session.sendScreenAnimation(animation(), { slot: 0, pageDelayMs: 0, ackDelayMs: 0, ackPollMs: 0 }),
    ).rejects.toThrow(/somente leitura/i);
    expect(t.sent).toEqual([]);
  });

  it("honors an abort signal before sending", async () => {
    const t = new RecordingTransport();
    const session = await openSession(t);
    const controller = new AbortController();
    controller.abort();

    await expect(
      session.sendScreenAnimation(animation(), {
        slot: 0,
        pageDelayMs: 0,
        ackDelayMs: 0, ackPollMs: 0,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(t.sent).toEqual([]);
  });
});
