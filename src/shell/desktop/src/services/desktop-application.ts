/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import "@noldova/teamrun-foundation-core";

import type { IElectron } from "../interfaces/i-electron.js";
import type { IIpcEvent } from "../interfaces/i-ipc-event.js";
import { DesktopSettings } from "../models/desktop-settings.js";
import { SenderInfo } from "../models/sender-info.js";
import { WindowAppearance } from "../models/window-appearance.js";
import { WindowState } from "../models/window-state.js";
import { Resources } from "../resources.js";
import { ApplicationMenu } from "./application-menu.js";
import { OpenWindow } from "./open-window.js";
import { SenderPolicy } from "./sender-policy.js";
import { WindowFactory } from "./window-factory.js";

export class DesktopApplication {
  private readonly electron: IElectron;
  private readonly settings: DesktopSettings;
  private readonly policy: SenderPolicy;
  private readonly factory: WindowFactory;
  private readonly windows: Map<number, OpenWindow> = new Map();

  private constructor(electron: IElectron, settings: DesktopSettings) {
    this.electron = electron;
    this.settings = settings;
    this.policy = new SenderPolicy(settings.windowUrl);
    this.factory = new WindowFactory(settings, this.policy, electron);
  }

  public static start(electron: IElectron, moduleUrl: string, platform: string): void {
    new DesktopApplication(electron, DesktopSettings.fromModule(dirname(fileURLToPath(moduleUrl)), platform)).run();
  }

  private run(): void {
    const app = this.electron.app;
    app.setName(Resources.applicationName);
    app.setAppUserModelId(Resources.appUserModelId);
    if (!app.requestSingleInstanceLock()) {
      app.quit();
      return;
    }
    app.enableSandbox();
    app.on(Resources.secondInstanceEvent, () => this.focus());
    app.on(Resources.windowAllClosedEvent, () => app.quit());
    void app.whenReady().then(() => this.ready());
  }

  private ready(): void {
    const session = this.electron.session.defaultSession;
    ApplicationMenu.install(this.electron.menu, this.settings);
    session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.setPermissionCheckHandler(() => false);
    this.electron.ipcMain.on(Resources.readyChannel, (event, appearance) => this.show(event, appearance));
    this.electron.ipcMain.handle(Resources.closeAnswerChannel, (event, requestId, isSaved) => this.answerClose(event, requestId, isSaved));
    this.electron.app.on(Resources.activateEvent, () => {
      if (this.windows.size === 0)
        this.open();
    });
    this.open();
  }

  private open(): void {
    const window = this.factory.create(WindowState.createDefault());
    const contentsId = window.webContents.id;
    this.windows.set(contentsId, new OpenWindow(window));
    window.once(Resources.closedEvent, () => this.windows.delete(contentsId));
  }

  private show(event: IIpcEvent, appearance: unknown): void {
    const open = this.findTrusted(event);
    if (Object.isNull(open))
      return;
    try {
      this.factory.show(open.window, WindowAppearance.fromJson(appearance));
    }
    catch (error) {
      process.stderr.write(`${Resources.formatAppearanceRejected(String(error))}\n`);
      open.window.show();
    }
  }

  private answerClose(event: IIpcEvent, requestId: unknown, isSaved: unknown): boolean {
    return this.findTrusted(event)?.coordinator.answer(requestId, isSaved) ?? false;
  }

  private findTrusted(event: IIpcEvent): OpenWindow | null {
    const frame = event.senderFrame;
    if (Object.isNull(frame) || !this.policy.isTrusted(new SenderInfo(frame.url, Object.isNull(frame.parent), event.sender.id)))
      return null;
    return this.windows.get(event.sender.id) ?? null;
  }

  private focus(): void {
    const [open] = this.windows.values();
    if (Object.isUndefined(open))
      return;
    if (open.window.isMinimized())
      open.window.restore();
    open.window.focus();
  }
}
