"use strict";

const { app, BrowserWindow, Menu, ipcMain, session } = require("electron");
const path = require("node:path");
const { fileURLToPath } = require("node:url");
const { K86HidDevice } = require("./k86-hid.cjs");

const DEV_SERVER_URL = "http://127.0.0.1:5173";
const DEV = !app.isPackaged && process.argv.includes("--dev");
const DIST_DIR = path.join(__dirname, "..", "dist");
const DIST_INDEX = path.join(DIST_DIR, "index.html");
const FEATURE_BYTES = 64;
const MAX_SCREEN_PACKETS = 106 * 1158 + 1;
// The renderer only needs the raw feature channel for identify. Screen pages
// go through the typed screen:send path. Future writes must add a typed
// handler instead of widening this allowlist.
const ALLOWED_FEATURE_OPCODES = new Set([0x8f]);

let mainWindow = null;
let hid = null;

function isAllowedNavigation(url) {
  if (DEV) {
    try {
      if (new URL(url).origin === DEV_SERVER_URL) return true;
    } catch {
      // Not a valid URL; fall through to the file check.
    }
  }
  try {
    const filePath = fileURLToPath(url);
    const relative = path.relative(DIST_DIR, filePath);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  } catch {
    return false;
  }
}

function senderUrl(event) {
  try {
    return event.senderFrame?.url ?? event.sender.getURL();
  } catch {
    return "";
  }
}

function assertTrustedSender(event) {
  if (!isAllowedNavigation(senderUrl(event))) {
    throw new Error("origem IPC não autorizada");
  }
}

function featurePayload(data) {
  if (!ArrayBuffer.isView(data) || data.byteLength !== FEATURE_BYTES) {
    throw new Error(`payload HID inválido: esperado Uint8Array de ${FEATURE_BYTES} bytes`);
  }
  if (!ALLOWED_FEATURE_OPCODES.has(data[0])) {
    throw new Error("opcode HID não permitido");
  }
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

function screenPayload(data, packetCount) {
  if (
    !Number.isInteger(packetCount) ||
    packetCount < 1 ||
    packetCount > MAX_SCREEN_PACKETS
  ) {
    throw new Error("quantidade de pacotes de tela inválida");
  }
  if (!ArrayBuffer.isView(data) || data.byteLength !== packetCount * FEATURE_BYTES) {
    throw new Error("lote de tela inválido");
  }
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

function notifyDisconnect() {
  closeHid();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("hid:disconnect");
  }
}

function closeHid() {
  const device = hid;
  hid = null;
  if (device) device.close();
}

function requireHid() {
  if (!hid) throw new Error("o teclado não está conectado");
  return hid;
}

function openHid() {
  closeHid();
  hid = K86HidDevice.open({ onDisconnect: notifyDisconnect });
  return hid.info;
}

function registerIpc() {
  ipcMain.handle("hid:open", (event) => {
    assertTrustedSender(event);
    return openHid();
  });

  ipcMain.handle("hid:close", (event) => {
    assertTrustedSender(event);
    closeHid();
  });

  ipcMain.handle("hid:send-feature", (event, data) => {
    assertTrustedSender(event);
    requireHid().sendFeature(featurePayload(data));
  });

  ipcMain.handle("hid:receive-feature", (event) => {
    assertTrustedSender(event);
    return requireHid().receiveFeature();
  });

  ipcMain.handle("screen:send", async (event, data, packetCount) => {
    assertTrustedSender(event);
    const device = requireHid();
    const batch = screenPayload(data, packetCount);
    const sender = event.sender;
    const cancel = () => device.cancelScreen();
    sender.once("destroyed", cancel);
    try {
      await device.sendScreen(batch, packetCount, (sent, total) => {
        if (!sender.isDestroyed()) {
          sender.send("screen:progress", { sent, total });
        }
      });
    } finally {
      sender.removeListener("destroyed", cancel);
    }
  });

  ipcMain.on("screen:cancel", (event) => {
    if (!isAllowedNavigation(senderUrl(event))) return;
    if (hid) hid.cancelScreen();
  });
}

function hardenSession() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  ses.setPermissionCheckHandler(() => false);
  ses.setSpellCheckerEnabled(false);
  ses.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    const allowed =
      url.startsWith("file://") ||
      url.startsWith("blob:") ||
      url.startsWith("data:") ||
      (DEV &&
        (url.startsWith(DEV_SERVER_URL) ||
          url.startsWith("ws://127.0.0.1:5173") ||
          url.startsWith("devtools://")));
    callback({ cancel: !allowed });
  });
}

function guardNavigation(event, url) {
  if (!isAllowedNavigation(url)) event.preventDefault();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 880,
    minWidth: 980,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b0d10",
    title: "K86 Studio",
    icon: path.join(__dirname, "..", "assets", "k86.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webviewTag: false,
      devTools: DEV,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    closeHid();
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", guardNavigation);
  mainWindow.webContents.on("will-redirect", guardNavigation);
  mainWindow.webContents.on("will-frame-navigate", guardNavigation);
  mainWindow.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
  mainWindow.webContents.on("render-process-gone", () => {
    closeHid();
  });

  if (DEV) {
    mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(DIST_INDEX);
  }
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.enableSandbox();

  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    hardenSession();
    registerIpc();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", closeHid);
}
