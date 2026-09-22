/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// The sandboxed preload can require only Electron's own modules, so the channel names are
// repeated here from the desktop Resources; the two must stay identical.

import electron = require("electron");
import type { IpcRendererEvent } from "electron";

const { contextBridge, ipcRenderer } = electron;

const invokeChannel = "teamrun:invoke";
const eventChannel = "teamrun:event";
const openExternalChannel = "teamrun:openExternal";
const pickDirectoryChannel = "teamrun:pickDirectory";
const infoChannel = "teamrun:info";
const titleBarChannel = "teamrun:titleBar";
const imageChannel = "teamrun:image";
const updateChannel = "teamrun:update";
const updateEventChannel = "teamrun:updateState";
const checkpointEventChannel = "teamrun:checkpoint";
const checkpointAckChannel = "teamrun:checkpointAck";
const bridgeName = "teamrun";

const bridge = {
  onCheckpoint(listener: (value: unknown) => void): () => void {
    const handler = (_event: IpcRendererEvent, payload: unknown): void => listener(payload);
    ipcRenderer.on(checkpointEventChannel, handler);
    return () => ipcRenderer.removeListener(checkpointEventChannel, handler);
  },
  checkpoint(result: unknown): Promise<boolean> {
    return ipcRenderer.invoke(checkpointAckChannel, result) as Promise<boolean>;
  },
  invoke(request: unknown): Promise<unknown> {
    return ipcRenderer.invoke(invokeChannel, request);
  },
  onEvent(listener: (event: unknown) => void): () => void {
    const handler = (_event: IpcRendererEvent, payload: unknown): void => listener(payload);
    ipcRenderer.on(eventChannel, handler);
    return () => ipcRenderer.removeListener(eventChannel, handler);
  },
  openExternal(url: string): Promise<boolean> {
    return ipcRenderer.invoke(openExternalChannel, url) as Promise<boolean>;
  },
  pickDirectory(): Promise<string | null> {
    return ipcRenderer.invoke(pickDirectoryChannel) as Promise<string | null>;
  },
  describe(): Promise<unknown> {
    return ipcRenderer.invoke(infoChannel);
  },
  update(command: string): Promise<unknown> {
    return ipcRenderer.invoke(updateChannel, command);
  },
  onUpdate(listener: (state: unknown) => void): () => void {
    const handler = (_event: IpcRendererEvent, payload: unknown): void => listener(payload);
    ipcRenderer.on(updateEventChannel, handler);
    return () => ipcRenderer.removeListener(updateEventChannel, handler);
  },
  setTitleBar(color: string, symbolColor: string): Promise<boolean> {
    return ipcRenderer.invoke(titleBarChannel, color, symbolColor) as Promise<boolean>;
  },
  readImage(path: string): Promise<string | null> {
    return ipcRenderer.invoke(imageChannel, path) as Promise<string | null>;
  }
};

contextBridge.exposeInMainWorld(bridgeName, bridge);
