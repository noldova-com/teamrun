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

contextBridge.exposeInMainWorld("teamrun", {
  platform: process.platform,
  notifyReady(appearance: unknown): void {
    ipcRenderer.send("teamrun:ready", appearance);
  },
  onCloseRequest(listener: (requestId: string) => void): () => void {
    const handler = (_event: IpcRendererEvent, requestId: string): void => listener(requestId);
    ipcRenderer.on("teamrun:closeRequest", handler);
    return () => ipcRenderer.removeListener("teamrun:closeRequest", handler);
  },
  answerClose(requestId: string, isSaved: boolean): Promise<boolean> {
    return ipcRenderer.invoke("teamrun:closeAnswer", requestId, isSaved) as Promise<boolean>;
  }
});
