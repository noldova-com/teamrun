/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BrowserWindowConstructorOptions } from "electron";

import type { IApplicationHost } from "./i-application-host.js";
import type { IClipboardHost } from "./i-clipboard-host.js";
import type { IDesktopWindow } from "./i-desktop-window.js";
import type { IDialogHost } from "./i-dialog-host.js";
import type { IDisplayHost } from "./i-display-host.js";
import type { IIpcHost } from "./i-ipc-host.js";
import type { IMenuHost } from "./i-menu-host.js";
import type { INotificationHost } from "./i-notification-host.js";
import type { ISessionHost } from "./i-session-host.js";
import type { IShellHost } from "./i-shell-host.js";
import type { ITrayHost } from "./i-tray-host.js";

export interface IElectron {
  readonly app: IApplicationHost;
  readonly ipcMain: IIpcHost;
  readonly session: ISessionHost;
  readonly screen: IDisplayHost;
  readonly menu: IMenuHost;
  readonly clipboard: IClipboardHost;
  readonly shell: IShellHost;
  readonly dialog: IDialogHost;
  readonly notifications: INotificationHost;
  readonly tray: ITrayHost;

  createWindow(options: BrowserWindowConstructorOptions): IDesktopWindow;
}
