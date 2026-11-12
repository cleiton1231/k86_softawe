"use strict";

/**
 * Synchronous node-hid driver for the K86 vendor collection.
 *
 * This module is loaded only by the Electron main process. Keeping it free of
 * Electron imports lets the same code run from a plain Node smoke test.
 */

const VENDOR_ID = 0x3151;
const PRODUCT_ID = 0x4015;
const VENDOR_USAGE_PAGE = 0xffff;
const VENDOR_USAGE = 0x0002;
const REPORT_SIZE = 64;
const FEATURE_REPORT_LENGTH = 65;
const ACK_ATTEMPTS = 10;
const ACK_DELAY_MS = 50;
const YIELD_EVERY = 4;
const MAX_SCREEN_PACKETS = 106 * 1158 + 1;

function delay(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/**
 * Yields to the libuv poll phase without paying the Windows timer granularity
 * (~15.6 ms). The blocking HID write already paces the USB transfers; this
 * keeps IPC progress and cancellation responsive without slowing the batch.
 */
function yieldToEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

function abortError() {
  const error = new Error("transferência cancelada");
  error.name = "AbortError";
  return error;
}

function loadHid() {
  try {
    return require("node-hid");
  } catch (error) {
    throw new Error(
      `não foi possível carregar node-hid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function selectVendorDevice(devices) {
  const candidates = devices.filter(
    (device) => device.vendorId === VENDOR_ID && device.productId === PRODUCT_ID,
  );
  return (
    candidates.find(
      (device) =>
        device.usagePage === VENDOR_USAGE_PAGE && device.usage === VENDOR_USAGE,
    ) ??
    candidates.find((device) => device.usagePage === VENDOR_USAGE_PAGE) ??
    null
  );
}

class K86HidDevice {
  constructor(device, info, onDisconnect) {
    this.device = device;
    this.info = info;
    this.onDisconnect = onDisconnect;
    this.closed = false;
    this.activeJob = null;
    this.message = Buffer.allocUnsafe(REPORT_SIZE + 1);

    device.on("error", () => {
      this.closed = true;
      if (this.activeJob) this.activeJob.cancelled = true;
      const callback = this.onDisconnect;
      this.onDisconnect = null;
      if (callback) {
        try {
          callback();
        } catch (error) {
          console.warn("K86: erro no handler de desconexão.", error);
        }
      }
    });
  }

  static open(options = {}) {
    const hid = loadHid();
    const match = selectVendorDevice(hid.devices());
    if (!match) {
      throw new Error(
        "teclado K86 não encontrado. Conecte o cabo USB e tente novamente.",
      );
    }
    let device;
    try {
      device = new hid.HID(match.path);
    } catch (error) {
      throw new Error(
        `não foi possível abrir o K86: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return new K86HidDevice(
      device,
      {
        vendorId: VENDOR_ID,
        productId: PRODUCT_ID,
        productName: match.product,
      },
      options.onDisconnect,
    );
  }

  requireOpen() {
    if (this.closed || !this.device) {
      throw new Error("o teclado não está mais conectado");
    }
  }

  fail(error) {
    if (this.closed) return;
    this.closed = true;
    if (this.activeJob) this.activeJob.cancelled = true;
    const device = this.device;
    this.device = null;
    if (device) {
      try {
        device.close();
      } catch {
        // The device may already be gone after an unplug.
      }
    }
    const callback = this.onDisconnect;
    this.onDisconnect = null;
    if (callback) {
      try {
        callback(error);
      } catch (callbackError) {
        console.warn("K86: erro no handler de desconexão.", callbackError);
      }
    }
  }

  sendFeature(data) {
    this.requireOpen();
    const payload = Buffer.from(data);
    const message = Buffer.allocUnsafe(payload.length + 1);
    message[0] = 0;
    payload.copy(message, 1);
    try {
      this.device.sendFeatureReport(message);
    } catch (error) {
      this.fail(error);
      throw error;
    }
  }

  receiveFeature() {
    this.requireOpen();
    const report = Array.from(
      this.device.getFeatureReport(0, FEATURE_REPORT_LENGTH),
    );
    // hidapi on Windows includes the report ID at [0]; WebHID does not. The
    // renderer expects the 64-byte protocol report, so strip the ID here.
    if (report.length === FEATURE_REPORT_LENGTH && report[0] === 0) {
      return report.slice(1);
    }
    return report;
  }

  sendPacketAt(batch, offset) {
    this.requireOpen();
    this.message[0] = 0;
    batch.copy(this.message, 1, offset, offset + REPORT_SIZE);
    this.sendMessage();
  }

  sendMessage() {
    try {
      this.device.sendFeatureReport(this.message);
    } catch (error) {
      this.fail(error);
      throw error;
    }
  }

  cancelScreen() {
    if (this.activeJob) this.activeJob.cancelled = true;
  }

  async waitForScreenAck(job) {
    if (job.cancelled) throw abortError();
    await delay(ACK_DELAY_MS);
    for (let attempt = 0; attempt < ACK_ATTEMPTS; attempt++) {
      if (job.cancelled) throw abortError();
      try {
        const reply = this.receiveFeature();
        // receiveFeature() strips the Windows report ID, so the protocol
        // acknowledge byte is [1], matching the WebHID path.
        if (reply[1] === 1) return;
      } catch {
        // The display may NAK while it prepares flash; keep polling.
      }
      await delay(ACK_DELAY_MS);
    }
    throw new Error("a tela do teclado não confirmou o início da transferência");
  }

  /**
   * Sends one announce packet followed by the page packets.
   *
   * @param {Buffer} batch concatenated 64-byte reports; packet 0 is the 0xA5
   *   announce and packets 1..n are 0x25 pages.
   * @param {number} packetCount number of 64-byte packets in `batch`.
   * @param {(sent: number, total: number) => void} [onProgress]
   */
  async sendScreen(batch, packetCount, onProgress) {
    this.requireOpen();
    if (
      !Number.isInteger(packetCount) ||
      packetCount < 1 ||
      packetCount > MAX_SCREEN_PACKETS
    ) {
      throw new Error("lote de tela inválido");
    }
    if (batch.length !== packetCount * REPORT_SIZE) {
      throw new Error(
        `lote de tela com ${batch.length} bytes; esperado ${packetCount * REPORT_SIZE}`,
      );
    }
    if (this.activeJob) {
      throw new Error("já existe um envio de tela em andamento");
    }

    const job = { cancelled: false };
    this.activeJob = job;
    const startedAt = Date.now();
    const packetAt = (index) =>
      batch.subarray(index * REPORT_SIZE, (index + 1) * REPORT_SIZE);

    try {
      const announce = packetAt(0);
      if (announce[0] !== 0xa5) {
        throw new Error("o lote de tela não começa com o anúncio 0xA5");
      }
      this.sendPacketAt(batch, 0);
      let sent = 1;
      onProgress?.(sent, packetCount);

      await this.waitForScreenAck(job);

      let lastFrame = announce[1];
      for (let index = 1; index < packetCount; index++) {
        if (job.cancelled) throw abortError();
        const offset = index * REPORT_SIZE;
        const opcode = batch[offset];
        if (opcode !== 0x25) {
          throw new Error(`pacote de tela inesperado: 0x${opcode.toString(16)}`);
        }
        const frame = batch[offset + 1];
        if (frame !== lastFrame) {
          onProgress?.(sent, packetCount);
          lastFrame = frame;
        }
        this.sendPacketAt(batch, offset);
        sent += 1;
        if (sent % YIELD_EVERY === 0) {
          await yieldToEventLoop();
        }
      }
      onProgress?.(sent, packetCount);
      console.log(
        `K86: ${packetCount} reports de tela em ${Date.now() - startedAt} ms`,
      );
    } finally {
      if (this.activeJob === job) this.activeJob = null;
    }
  }

  close() {
    this.cancelScreen();
    this.closed = true;
    const device = this.device;
    this.device = null;
    this.onDisconnect = null;
    if (!device) return;
    try {
      device.close();
    } catch {
      // The device may already be gone after an unplug.
    }
  }
}

module.exports = {
  K86HidDevice,
  VENDOR_ID,
  PRODUCT_ID,
  REPORT_SIZE,
};
