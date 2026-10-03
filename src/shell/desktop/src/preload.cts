/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import electron = require("electron");
import type { IpcRendererEvent } from "electron";

const { contextBridge, ipcRenderer } = electron;

function readAppearance(): unknown {
  const argument = process.argv.find(t => t.startsWith("--teamrun-appearance="));
  try {
    return argument === undefined ? null : JSON.parse(argument.slice("--teamrun-appearance=".length));
  }
  catch {
    return null;
  }
}

contextBridge.exposeInMainWorld("teamrun", {
  platform: process.platform,
  appearance: readAppearance(),
  notifyReady(appearance: unknown): void {
    ipcRenderer.send("teamrun:ready", appearance);
  },
  notifyAppearance(appearance: unknown): void {
    ipcRenderer.send("teamrun:appearance", appearance);
  },
  onCloseRequest(listener: (requestId: string) => void): () => void {
    const handler = (_event: IpcRendererEvent, requestId: string): void => listener(requestId);
    ipcRenderer.on("teamrun:closeRequest", handler);
    return () => ipcRenderer.removeListener("teamrun:closeRequest", handler);
  },
  answerClose(requestId: string, isSaved: boolean): Promise<boolean> {
    return ipcRenderer.invoke("teamrun:closeAnswer", requestId, isSaved) as Promise<boolean>;
  },
  readStartup(): Promise<unknown> {
    return ipcRenderer.invoke("teamrun:readStartup");
  },
  onStartup(listener: (state: unknown) => void): () => void {
    const handler = (_event: IpcRendererEvent, state: unknown): void => listener(state);
    ipcRenderer.on("teamrun:startupState", handler);
    return () => ipcRenderer.removeListener("teamrun:startupState", handler);
  },
  actOnStartup(action: string): Promise<boolean> {
    return ipcRenderer.invoke("teamrun:startupAction", action) as Promise<boolean>;
  },
  readLayout(): Promise<unknown> {
    return ipcRenderer.invoke("teamrun:readLayout");
  },
  writeLayout(layout: unknown): Promise<unknown> {
    return ipcRenderer.invoke("teamrun:writeLayout", layout);
  },
  request(method: string, payload: unknown): Promise<unknown> {
    return ipcRenderer.invoke("teamrun:request", method, payload);
  },
  onEvent(listener: (name: string, payload: unknown) => void): () => void {
    const handler = (_event: IpcRendererEvent, name: string, payload: unknown): void => listener(name, payload);
    ipcRenderer.on("teamrun:runtimeEvent", handler);
    return () => ipcRenderer.removeListener("teamrun:runtimeEvent", handler);
  },
  readBuild(): Promise<unknown> {
    return ipcRenderer.invoke("teamrun:readBuild");
  },
  copyText(text: string): Promise<boolean> {
    return ipcRenderer.invoke("teamrun:copyText", text) as Promise<boolean>;
  },
  openLogFolder(): Promise<boolean> {
    return ipcRenderer.invoke("teamrun:openLogFolder") as Promise<boolean>;
  },
  keepAppearance(preferences: unknown): void {
    ipcRenderer.send("teamrun:keepAppearance", preferences);
  },
  onNotificationOpened(listener: (id: number) => void): () => void {
    const handler = (_event: IpcRendererEvent, id: number): void => listener(id);
    ipcRenderer.on("teamrun:notificationOpened", handler);
    return () => ipcRenderer.removeListener("teamrun:notificationOpened", handler);
  }
});
