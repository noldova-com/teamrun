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
import { FakeDesktopWindow } from "./fake-desktop-window.fixture.js";
import { FakeIpcHost } from "./fake-ipc-host.fixture.js";
import { FakeMenuHost } from "./fake-menu-host.fixture.js";
import { FakePermissionHost } from "./fake-permission-host.fixture.js";

export class FakeElectron implements IElectron {
  public readonly app: FakeApplicationHost;
  public readonly ipcMain: FakeIpcHost = new FakeIpcHost();
  public readonly permissions: FakePermissionHost = new FakePermissionHost();
  public readonly session: ISessionHost = { defaultSession: this.permissions };
  public readonly menu: FakeMenuHost = new FakeMenuHost();
  public readonly windows: FakeDesktopWindow[] = [];

  public constructor(hasLock: boolean = true) {
    this.app = new FakeApplicationHost(hasLock);
  }

  public createWindow(options: BrowserWindowConstructorOptions): FakeDesktopWindow {
    const window = new FakeDesktopWindow(options, this.windows.length + 1);
    this.windows.push(window);
    return window;
  }
}
