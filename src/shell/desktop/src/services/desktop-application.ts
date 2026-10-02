/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IpcMainEvent, type IpcMainInvokeEvent, app, ipcMain, screen, session } from "electron";

import "@noldova/teamrun-foundation-core";

import type { DesktopSettings } from "../models/desktop-settings.js";
import { ScreenArea } from "../models/screen-area.js";
import { SenderInfo } from "../models/sender-info.js";
import { WindowAppearance } from "../models/window-appearance.js";
import { WindowState } from "../models/window-state.js";
import { Resources } from "../resources.js";
import { ApplicationMenu } from "./application-menu.js";
import { OpenWindow } from "./open-window.js";
import type { SenderPolicy } from "./sender-policy.js";
import type { WindowFactory } from "./window-factory.js";

export class DesktopApplication {
  private readonly settings: DesktopSettings;
  private readonly policy: SenderPolicy;
  private readonly factory: WindowFactory;
  private readonly windows: Map<number, OpenWindow> = new Map();

  public constructor(settings: DesktopSettings, policy: SenderPolicy, factory: WindowFactory) {
    this.settings = settings;
    this.policy = policy;
    this.factory = factory;
  }

  public run(): void {
    app.setName(Resources.applicationName);
    app.setAppUserModelId(Resources.appUserModelId);
    if (!app.requestSingleInstanceLock()) {
      app.quit();
      return;
    }
    app.enableSandbox();
    app.on(Resources.secondInstanceEvent, () => this.focus());
    app.on(Resources.windowAllClosedEvent, () => app.quit());
    void app.whenReady().then(() => this.start());
  }

  private start(): void {
    ApplicationMenu.install(this.settings);
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    ipcMain.on(Resources.readyChannel, (event, appearance: unknown) => this.show(event, appearance));
    ipcMain.handle(Resources.closeAnswerChannel, (event, requestId: unknown, isSaved: unknown) => this.answerClose(event, requestId, isSaved));
    app.on(Resources.activateEvent, () => {
      if (this.windows.size === 0)
        this.open();
    });
    this.open();
  }

  private open(): void {
    const areas = screen.getAllDisplays().map(t => new ScreenArea(t.workArea.x, t.workArea.y, t.workArea.width, t.workArea.height));
    const window = this.factory.create(WindowState.createDefault().placeOn(areas));
    const contentsId = window.webContents.id;
    this.windows.set(contentsId, new OpenWindow(window));
    window.once(Resources.closedEvent, () => this.windows.delete(contentsId));
  }

  private show(event: IpcMainEvent, appearance: unknown): void {
    const open = this.findTrusted(event);
    if (Object.isNull(open))
      return;
    try {
      this.factory.show(open.window, WindowAppearance.fromJson(appearance));
    }
    catch (error) {
      process.stderr.write(`${Resources.formatAppearanceRejected(error instanceof Error ? error.message : String(error))}\n`);
      open.window.show();
    }
  }

  private answerClose(event: IpcMainInvokeEvent, requestId: unknown, isSaved: unknown): boolean {
    return this.findTrusted(event)?.coordinator.answer(requestId, isSaved) ?? false;
  }

  private findTrusted(event: IpcMainEvent | IpcMainInvokeEvent): OpenWindow | null {
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
