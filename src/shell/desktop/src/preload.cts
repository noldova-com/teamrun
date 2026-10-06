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
  openLink(url: string): Promise<boolean> {
    return ipcRenderer.invoke("teamrun:openLink", url) as Promise<boolean>;
  },
  installCommand(): Promise<boolean> {
    return ipcRenderer.invoke("teamrun:installCommand") as Promise<boolean>;
  },
  keepAppearance(preferences: unknown): void {
    ipcRenderer.send("teamrun:keepAppearance", preferences);
  },
  readSpelling(): Promise<unknown> {
    return ipcRenderer.invoke("teamrun:readSpelling");
  },
  keepSpelling(isChecking: boolean, languages: readonly string[]): void {
    ipcRenderer.send("teamrun:spelling", isChecking, languages);
  },
  onFieldMenu(listener: (request: unknown) => void): () => void {
    const handler = (_event: IpcRendererEvent, request: unknown): void => listener(request);
    ipcRenderer.on("teamrun:fieldMenu", handler);
    return () => ipcRenderer.removeListener("teamrun:fieldMenu", handler);
  },
  replaceMisspelling(text: string): Promise<boolean> {
    return ipcRenderer.invoke("teamrun:replaceMisspelling", text) as Promise<boolean>;
  },
  edit(action: string): Promise<boolean> {
    return ipcRenderer.invoke("teamrun:edit", action) as Promise<boolean>;
  },
  setMenuBar(menuBar: unknown): void {
    ipcRenderer.send("teamrun:menuBar", menuBar);
  },
  onMenuCommand(listener: (id: string) => void): () => void {
    const handler = (_event: IpcRendererEvent, id: string): void => listener(id);
    ipcRenderer.on("teamrun:menuCommand", handler);
    return () => ipcRenderer.removeListener("teamrun:menuCommand", handler);
  },
  onNotificationOpened(listener: (id: string) => void): () => void {
    const handler = (_event: IpcRendererEvent, id: string): void => listener(id);
    ipcRenderer.on("teamrun:notificationOpened", handler);
    return () => ipcRenderer.removeListener("teamrun:notificationOpened", handler);
  },
  onQuitQuestion(listener: (question: unknown) => void): () => void {
    const handler = (_event: IpcRendererEvent, question: unknown): void => listener(question);
    ipcRenderer.on("teamrun:quitQuestion", handler);
    return () => ipcRenderer.removeListener("teamrun:quitQuestion", handler);
  },
  answerQuit(choice: string): Promise<boolean> {
    return ipcRenderer.invoke("teamrun:quitAnswer", choice) as Promise<boolean>;
  },
  readTrayAvailable(): Promise<unknown> {
    return ipcRenderer.invoke("teamrun:readTrayAvailable");
  },
  onTrayAvailable(listener: (isAvailable: boolean) => void): () => void {
    const handler = (_event: IpcRendererEvent, isAvailable: boolean): void => listener(isAvailable);
    ipcRenderer.on("teamrun:trayAvailable", handler);
    return () => ipcRenderer.removeListener("teamrun:trayAvailable", handler);
  },
  logModule(moduleId: string, message: string): void {
    ipcRenderer.send("teamrun:moduleLog", moduleId, message);
  },
  logError(moduleId: string | null, text: string): void {
    ipcRenderer.send("teamrun:windowError", moduleId, text);
  }
});
