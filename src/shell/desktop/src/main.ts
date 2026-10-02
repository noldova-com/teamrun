/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { homedir } from "node:os";

import { BrowserWindow, Menu, app, clipboard, ipcMain, screen, session, shell, utilityProcess } from "electron";

import { ChildProcessStarter, RuntimeBuild, RuntimeLauncher } from "@noldova/teamrun-shell-runtime";

import { Resources } from "./resources.js";
import { DesktopApplication } from "./services/desktop-application.js";
import { DeviceIdentity } from "./services/device-identity.js";
import { UtilityProcessStarter } from "./services/utility-process-starter.js";

const starter = process.platform === Resources.windowsPlatform ? new UtilityProcessStarter(utilityProcess) : new ChildProcessStarter();

DesktopApplication.start(
  { app, ipcMain, session, screen, menu: Menu, clipboard, shell, createWindow: t => new BrowserWindow(t) },
  {
    argv: process.argv,
    env: process.env,
    platform: process.platform,
    execPath: process.execPath,
    homeFolder: homedir(),
    workingDirectory: process.cwd(),
    errorOutput: process.stderr,
    startDetached: t => spawn(t, [], { detached: true, stdio: "ignore" }).unref()
  },
  import.meta.url,
  t => new RuntimeLauncher(t, RuntimeBuild.identity, starter),
  t => DeviceIdentity.readOrCreateAsync(t));
