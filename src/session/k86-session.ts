import { findDeviceById } from "../devices/k86";
import type { DeviceDefinition } from "../devices/types";
import type { HidTransport } from "../hid/transport";
import { decodeIdentify, identifyPacket } from "../protocol/identify";
import {
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  encodeScreenPixels,
  maxScreenFrames,
  screenAnnouncePacket,
  screenPagePackets,
} from "../protocol/screen";
import type { ScreenAnimation } from "../screen/decode";

const REPORT_ID = 0;
const SCREEN_ACK_ATTEMPTS = 10;

export class UnsupportedDeviceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedDeviceError";
  }
}

export class ScreenAckError extends Error {
  constructor(message = "a tela do teclado não confirmou o início da transferência") {
    super(message);
    this.name = "ScreenAckError";
  }
}

export interface ScreenTransferOptions {
  slot: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
  /** Test hook: page pacing in ms. The vendor uses 1–2 ms. */
  pageDelayMs?: number;
  /** Test hook: wait after the announce before polling for the ack. */
  ackDelayMs?: number;
  /** Test hook: gap between ack polls. */
  ackPollMs?: number;
}

function abortError(): Error {
  const error = new Error("transferência cancelada");
  error.name = "AbortError";
  return error;
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

const WRITE_CAPABLE_DEVICE_IDS = new Set([1168]);

function hexWord(value: number): string {
  return `0x${value.toString(16).padStart(4, "0")}`;
}

async function closeAfterFailedOpen(transport: HidTransport): Promise<void> {
  try {
    await transport.close();
  } catch (error) {
    console.warn(
      "K86Session: falha ao fechar o transporte após erro de identificação.",
      error,
    );
  }
}

/**
 * Read-only identification session for a K86 device.
 *
 * This phase exposes no read or write operations beyond identification.
 * Unknown device IDs still produce a session, but it is marked
 * `recognized: false` and receives a conservative yc500 fallback definition.
 *
 * `writesAllowed` is a hardware-validation policy, separate from model
 * recognition: the yc500 `1168` may write in a later phase, while the gen2
 * revisions `2730` and `4094` stay read-only until validated on hardware.
 * `readOnly` is kept as the existing UI gate and is the inverse of
 * `writesAllowed`.
 */
export class K86Session {
  readonly definition: DeviceDefinition;
  readonly deviceId: number;
  readonly recognized: boolean;
  readonly writesAllowed: boolean;
  readonly readOnly: boolean;

  private readonly transport: HidTransport;

  private constructor(
    transport: HidTransport,
    definition: DeviceDefinition,
    recognized: boolean,
    writesAllowed: boolean,
  ) {
    this.transport = transport;
    this.definition = definition;
    this.deviceId = definition.id;
    this.recognized = recognized;
    this.writesAllowed = writesAllowed;
    this.readOnly = !writesAllowed;
  }

  /**
   * Identifies the device and takes ownership of the transport.
   *
   * If identification fails, the transport is closed before the original
   * error is rethrown; the caller must not reuse it. On success the caller
   * owns the returned session and must call `close()` when done.
   */
  static async open(transport: HidTransport): Promise<K86Session> {
    try {
      await transport.sendFeatureReport(REPORT_ID, identifyPacket());
      const reply = await transport.receiveFeatureReport(REPORT_ID);
      const { deviceId } = decodeIdentify(reply);
      const known = findDeviceById(deviceId);

      if (known) {
        if (known.pid !== transport.info.productId) {
          throw new UnsupportedDeviceError(
            `Dispositivo não suportado: ${known.name} espera PID ${hexWord(known.pid)}, mas o dispositivo reportou PID ${hexWord(transport.info.productId)}.`,
          );
        }
        if (known.vid !== transport.info.vendorId) {
          throw new UnsupportedDeviceError(
            `Dispositivo não suportado: ${known.name} espera VID ${hexWord(known.vid)}, mas o dispositivo reportou VID ${hexWord(transport.info.vendorId)}.`,
          );
        }
        return new K86Session(
          transport,
          known,
          true,
          WRITE_CAPABLE_DEVICE_IDS.has(known.id),
        );
      }

      // Unknown revisions are only identified in this phase. The fallback
      // definition keeps the real transport metadata and the standard K86
      // screen/profile shape so read-only UI code has a stable contract.
      const fallback: DeviceDefinition = {
        id: deviceId,
        vid: transport.info.vendorId,
        pid: transport.info.productId,
        family: "yc500",
        name: "Unknown K86",
        layout: "ansi",
        screen: { width: 240, height: 135, slots: 5 },
        profiles: 3,
      };
      return new K86Session(transport, fallback, false, false);
    } catch (error) {
      await closeAfterFailedOpen(transport);
      throw error;
    }
  }

  async sendFeatureReport(data: Uint8Array): Promise<void> {
    await this.transport.sendFeatureReport(REPORT_ID, data);
  }

  async receiveFeatureReport(): Promise<Uint8Array> {
    return this.transport.receiveFeatureReport(REPORT_ID);
  }

  /**
   * Writes a still image or an animation to one of the five screen slots.
   *
   * The announce is retried until the display answers `reply[1] === 1`.
   * Data pages are only sent after that acknowledgement. The method does not
   * erase the screen flash; it overwrites the chosen slot.
   */
  async sendScreenAnimation(
    animation: ScreenAnimation,
    options: ScreenTransferOptions,
  ): Promise<void> {
    if (!this.writesAllowed) {
      throw new Error(
        "Este dispositivo está em modo somente leitura; gravação na tela não está habilitada.",
      );
    }
    if (
      !Number.isInteger(options.slot) ||
      options.slot < 0 ||
      options.slot >= this.definition.screen.slots
    ) {
      throw new Error(
        `slot inválido: ${options.slot}; use 0..${this.definition.screen.slots - 1}`,
      );
    }
    if (animation.width !== SCREEN_WIDTH || animation.height !== SCREEN_HEIGHT) {
      throw new Error(
        `a tela espera ${SCREEN_WIDTH}x${SCREEN_HEIGHT}, recebeu ${animation.width}x${animation.height}`,
      );
    }
    if (animation.frames.length === 0) {
      throw new Error("a animação não contém frames");
    }
    const limit = maxScreenFrames();
    if (animation.frames.length > limit) {
      throw new Error(
        `a animação tem ${animation.frames.length} frames; o limite desta tela é ${limit}`,
      );
    }

    const frameData = animation.frames.map((frame) =>
      encodeScreenPixels(frame, SCREEN_WIDTH, SCREEN_HEIGHT),
    );
    const frameCount = frameData.length;
    const still = frameCount === 1;
    const delayMs = still
      ? 0
      : Math.max(0, Math.min(255, Math.round(animation.delayMs)));
    const slot = options.slot;
    const pageDelayMs = options.pageDelayMs ?? 2;
    const ackDelayMs = options.ackDelayMs ?? 50;
    const ackPollMs = options.ackPollMs ?? 50;
    const signal = options.signal;

    if (signal?.aborted) throw abortError();

    // A still picture uses the slot as its frame index and layer 0, matching
    // the vendor's PNG path. An animation uses frame indices and carries the
    // requested slot in byte 18 of the announce.
    const announce = screenAnnouncePacket({
      frame: still ? slot : 0,
      frameCount,
      delayMs,
      length: frameData[0].length,
      bbox: { left: 0, top: 0, right: SCREEN_WIDTH, bottom: SCREEN_HEIGHT },
      slot: still ? 0 : slot,
    });

    // The working K86 implementation sends the announce once, waits, then
    // polls feature reports. Some Windows stacks expose the report ID at
    // byte 0, so the protocol's acknowledge byte can be at [1] or [2].
    await this.sendFeatureReport(announce);
    await sleep(ackDelayMs);

    let acknowledged = false;
    for (let attempt = 0; attempt < SCREEN_ACK_ATTEMPTS; attempt++) {
      if (signal?.aborted) throw abortError();
      try {
        const reply = await this.receiveFeatureReport();
        if (reply[1] === 1 || reply[2] === 1) {
          acknowledged = true;
          break;
        }
      } catch {
        // A missing report is expected while the display is busy; keep polling.
      }
      await sleep(ackPollMs);
    }
    if (!acknowledged) throw new ScreenAckError();

    for (let frame = 0; frame < frameCount; frame++) {
      if (signal?.aborted) throw abortError();
      const pages = screenPagePackets({
        frame: still ? slot : frame,
        frameCount,
        delayMs,
        data: frameData[frame],
      });
      for (const page of pages) {
        if (signal?.aborted) throw abortError();
        await this.sendFeatureReport(page);
        await sleep(pageDelayMs);
      }
      options.onProgress?.(frame + 1, frameCount);
    }
  }

  async close(): Promise<void> {
    await this.transport.close();
  }
}
