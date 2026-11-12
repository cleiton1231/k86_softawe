"use strict";

const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("k86Native", {
  openHid: () => ipcRenderer.invoke("hid:open"),
  closeHid: () => ipcRenderer.invoke("hid:close"),
  sendFeature: (data) => ipcRenderer.invoke("hid:send-feature", data),
  receiveFeature: () => ipcRenderer.invoke("hid:receive-feature"),
  sendScreenPackets: (data, packetCount) =>
    ipcRenderer.invoke("screen:send", data, packetCount),
  cancelScreen: () => ipcRenderer.send("screen:cancel"),
  onScreenProgress: (callback) => subscribe("screen:progress", callback),
  onHidDisconnect: (callback) => subscribe("hid:disconnect", callback),
});
