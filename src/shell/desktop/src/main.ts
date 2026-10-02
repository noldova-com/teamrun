/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { homedir } from "node:os";

import { BrowserWindow, Menu, app, ipcMain, screen, session } from "electron";

import { RuntimeBuild, RuntimeLauncher } from "@noldova/teamrun-shell-runtime";

import { DesktopApplication } from "./services/desktop-application.js";
import { DeviceIdentity } from "./services/device-identity.js";

DesktopApplication.start(
  { app, ipcMain, session, screen, menu: Menu, createWindow: t => new BrowserWindow(t) },
  {
    argv: process.argv,
    env: process.env,
    platform: process.platform,
    execPath: process.execPath,
    homeFolder: homedir(),
    workingDirectory: process.cwd(),
    startDetached: t => spawn(t, [], { detached: true, stdio: "ignore" }).unref()
  },
  import.meta.url,
  t => new RuntimeLauncher(t, RuntimeBuild.identity),
  t => DeviceIdentity.readOrCreateAsync(t));
