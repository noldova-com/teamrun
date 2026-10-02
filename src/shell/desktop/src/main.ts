/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BrowserWindow, Menu, app, ipcMain, session } from "electron";

import { DesktopApplication } from "./services/desktop-application.js";

DesktopApplication.start({ app, ipcMain, session, menu: Menu, createWindow: t => new BrowserWindow(t) }, import.meta.url, process.platform);
