"use strict";

const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("node:path");
const { K86HidDevice } = require("./k86-hid.cjs");

const DEV_SERVER_URL = "http://127.0.0.1:5173";
const DEV = process.argv.includes("--dev");

let mainWindow = null;
let hid = null;

function notifyDisconnect() {
  hid = null;
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
  ipcMain.handle("hid:open", () => openHid());

  ipcMain.handle("hid:close", () => {
    closeHid();
  });

  ipcMain.handle("hid:send-feature", (_event, data) => {
    requireHid().sendFeature(data);
  });

  ipcMain.handle("hid:receive-feature", () => requireHid().receiveFeature());

  ipcMain.handle("screen:send", async (event, data, packetCount) => {
    const device = requireHid();
    const sender = event.sender;
    await device.sendScreen(Buffer.from(data), packetCount, (sent, total) => {
      if (!sender.isDestroyed()) {
        sender.send("screen:progress", { sent, total });
      }
    });
  });

  ipcMain.on("screen:cancel", () => {
    if (hid) hid.cancelScreen();
  });
}

function isAllowedNavigation(url) {
  if (url.startsWith(`${DEV_SERVER_URL}/`)) return true;
  return url.startsWith("file:///");
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
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webviewTag: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url)) event.preventDefault();
  });

  if (DEV) {
    mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
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
