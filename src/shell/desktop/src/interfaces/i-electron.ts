/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BrowserWindowConstructorOptions } from "electron";

import type { IApplicationHost } from "./i-application-host.js";
import type { IDesktopWindow } from "./i-desktop-window.js";
import type { IDisplayHost } from "./i-display-host.js";
import type { IIpcHost } from "./i-ipc-host.js";
import type { IMenuHost } from "./i-menu-host.js";
import type { ISessionHost } from "./i-session-host.js";

export interface IElectron {
  readonly app: IApplicationHost;
  readonly ipcMain: IIpcHost;
  readonly session: ISessionHost;
  readonly screen: IDisplayHost;
  readonly menu: IMenuHost;

  createWindow(options: BrowserWindowConstructorOptions): IDesktopWindow;
}
