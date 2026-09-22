/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BrowserWindow, type IpcMainInvokeEvent, dialog, ipcMain, shell } from "electron";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";

import type { IBridgeHandlers } from "../interfaces/i-bridge-handlers.js";
import type { IBridgeHost } from "../interfaces/i-bridge-host.js";
import { SenderInfo } from "../models/sender-info.js";
import { Resources } from "../resources.js";

export class ElectronBridgeHost implements IBridgeHost {
  public attach(handlers: IBridgeHandlers): void {
    ipcMain.handle(Resources.invokeChannel, (event: IpcMainInvokeEvent, request: unknown) =>
      handlers.invoke(ElectronBridgeHost.describeSender(event), request));
    ipcMain.handle(Resources.openExternalChannel, (event: IpcMainInvokeEvent, url: unknown) =>
      handlers.openExternal(ElectronBridgeHost.describeSender(event), url));
    ipcMain.handle(Resources.pickDirectoryChannel, (event: IpcMainInvokeEvent) => handlers.pickDirectory(ElectronBridgeHost.describeSender(event)));
    ipcMain.handle(Resources.infoChannel, (event: IpcMainInvokeEvent) => handlers.describe(ElectronBridgeHost.describeSender(event)));
    ipcMain.handle(Resources.updateChannel, (event: IpcMainInvokeEvent, command: unknown) =>
      handlers.update(ElectronBridgeHost.describeSender(event), command));
    ipcMain.handle(Resources.checkpointAckChannel, (event: IpcMainInvokeEvent, result: unknown) =>
      handlers.checkpoint(ElectronBridgeHost.describeSender(event), result));
    ipcMain.handle(Resources.titleBarChannel, (event: IpcMainInvokeEvent, color: unknown, symbolColor: unknown) =>
      handlers.setTitleBar(ElectronBridgeHost.describeSender(event), color, symbolColor));
    ipcMain.handle(Resources.imageChannel, (event: IpcMainInvokeEvent, path: unknown) => handlers.readImage(ElectronBridgeHost.describeSender(event), path));
  }

  public broadcast(channel: string, payload: JsonValue): void {
    for (const window of BrowserWindow.getAllWindows())
      if (!window.isDestroyed())
        window.webContents.send(channel, payload);
  }

  public windowIds(): readonly number[] {
    return BrowserWindow.getAllWindows().filter(t => !t.isDestroyed()).map(t => t.webContents.id);
  }

  public sendToWindow(windowId: number, channel: string, payload: JsonValue): void {
    const window = BrowserWindow.getAllWindows().find(t => !t.isDestroyed() && t.webContents.id === windowId);
    window?.webContents.send(channel, payload);
  }

  public setTitleBar(color: string, symbolColor: string): void {
    for (const window of BrowserWindow.getAllWindows())
      if (!window.isDestroyed() && Object.isFunction(window.setTitleBarOverlay))
        window.setTitleBarOverlay({ color, symbolColor, height: Resources.titleBarHeight });
  }

  public openExternal(url: string): Promise<void> {
    return shell.openExternal(url);
  }

  public async pickDirectory(): Promise<string | null> {
    const window = BrowserWindow.getFocusedWindow();
    const options = { properties: [Resources.openDirectoryProperty], title: Resources.directoryDialogTitle };
    const result = Object.isNull(window) ? await dialog.showOpenDialog(options) : await dialog.showOpenDialog(window, options);

    return result.canceled ? null : result.filePaths[0] ?? null;
  }

  private static describeSender(event: IpcMainInvokeEvent): SenderInfo {
    const frame = event.senderFrame;
    return Object.isNull(frame) ? new SenderInfo(String.empty, false) : new SenderInfo(frame.url, Object.isNull(frame.parent), event.sender.id);
  }
}
