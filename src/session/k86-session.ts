import { findDeviceById } from "../devices/k86";
import type { DeviceDefinition } from "../devices/types";
import type { HidTransport } from "../hid/transport";
import { decodeIdentify, identifyPacket } from "../protocol/identify";

const REPORT_ID = 0;

export class UnsupportedDeviceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedDeviceError";
  }
}

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
 * Unknown device IDs still produce a session, but it is marked `readOnly`
 * and receives a conservative yc500 fallback definition.
 */
export class K86Session {
  readonly definition: DeviceDefinition;
  readonly deviceId: number;
  readonly readOnly: boolean;

  private readonly transport: HidTransport;

  private constructor(
    transport: HidTransport,
    definition: DeviceDefinition,
    readOnly: boolean,
  ) {
    this.transport = transport;
    this.definition = definition;
    this.deviceId = definition.id;
    this.readOnly = readOnly;
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
        return new K86Session(transport, known, false);
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
      return new K86Session(transport, fallback, true);
    } catch (error) {
      await closeAfterFailedOpen(transport);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.transport.close();
  }
}
