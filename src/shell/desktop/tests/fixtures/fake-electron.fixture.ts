/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BrowserWindowConstructorOptions } from "electron";

import type { IElectron, ISessionHost } from "@noldova/teamrun-shell-desktop";

import { FakeApplicationHost } from "./fake-application-host.fixture.js";
import { FakeClipboardHost } from "./fake-clipboard-host.fixture.js";
import { FakeDesktopWindow } from "./fake-desktop-window.fixture.js";
import { FakeDialogHost } from "./fake-dialog-host.fixture.js";
import { FakeDisplayHost } from "./fake-display-host.fixture.js";
import { FakeIpcHost } from "./fake-ipc-host.fixture.js";
import { FakeMenuHost } from "./fake-menu-host.fixture.js";
import { FakeNativeUpdater } from "./fake-native-updater.fixture.js";
import { FakeNotificationHost } from "./fake-notification-host.fixture.js";
import { FakeSession } from "./fake-session.fixture.js";
import { FakeShellHost } from "./fake-shell-host.fixture.js";
import { FakeTrayHost } from "./fake-tray-host.fixture.js";

export class FakeElectron implements IElectron {
  public readonly app: FakeApplicationHost;
  public readonly ipcMain: FakeIpcHost = new FakeIpcHost();
  public readonly defaultSession: FakeSession = new FakeSession();
  public readonly session: ISessionHost = { defaultSession: this.defaultSession };
  public readonly menu: FakeMenuHost = new FakeMenuHost();
  public readonly screen: FakeDisplayHost = new FakeDisplayHost();
  public readonly clipboard: FakeClipboardHost = new FakeClipboardHost();
  public readonly shell: FakeShellHost = new FakeShellHost();
  public readonly dialog: FakeDialogHost = new FakeDialogHost();
  public readonly notifications: FakeNotificationHost = new FakeNotificationHost();
  public readonly tray: FakeTrayHost = new FakeTrayHost();
  public readonly nativeUpdater: FakeNativeUpdater = new FakeNativeUpdater();
  public readonly windows: FakeDesktopWindow[] = [];

  public constructor(hasLock: boolean = true, isPackaged: boolean = false) {
    this.app = new FakeApplicationHost(hasLock, isPackaged);
    this.nativeUpdater.onInstall = () => this.app.quit();
  }

  public createWindow(options: BrowserWindowConstructorOptions): FakeDesktopWindow {
    const window = new FakeDesktopWindow(options, this.windows.length + 1);
    this.windows.push(window);
    return window;
  }
}
