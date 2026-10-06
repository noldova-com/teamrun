/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { promisify } from "node:util";

import { BrowserWindow, Menu, Notification, Tray, app, clipboard, dialog, ipcMain, screen, session, shell, utilityProcess } from "electron";

import "@noldova/teamrun-foundation-core";
import { ChildProcessStarter, ProcessPresence, RuntimeBuild, RuntimeLauncher, SystemCommand } from "@noldova/teamrun-shell-runtime";

import { Resources } from "./resources.js";
import { AppearanceStore } from "./services/appearance-store.js";
import { ChildProgramHost } from "./services/child-program-host.js";
import { DesktopApplication } from "./services/desktop-application.js";
import { DesktopRecord } from "./services/desktop-record.js";
import { DeviceIdentity } from "./services/device-identity.js";
import { PathCommand } from "./services/path-command.js";
import { UtilityProcessStarter } from "./services/utility-process-starter.js";

const starter = process.platform === Resources.windowsPlatform ? new UtilityProcessStarter(utilityProcess) : new ChildProcessStarter();
const programs = new ChildProgramHost(process.platform, Resources.programTimeout);

DesktopApplication.start(
  {
    app,
    ipcMain,
    session,
    screen,
    menu: Menu,
    clipboard,
    shell,
    dialog: {
      showMessageBox: (windowId, options) => {
        const window = Object.isNull(windowId) ? null : BrowserWindow.fromId(windowId);
        return Object.isNull(window) ? dialog.showMessageBox(options) : dialog.showMessageBox(window, options);
      }
    },
    notifications: { isSupported: () => Notification.isSupported(), create: t => new Notification(t) },
    tray: { create: t => new Tray(t) },
    createWindow: t => new BrowserWindow(t)
  },
  {
    argv: process.argv,
    env: process.env,
    platform: process.platform,
    execPath: process.execPath,
    homeFolder: homedir(),
    workingDirectory: process.cwd(),
    isDefaultApp: process.defaultApp === true,
    errorOutput: process.stderr,
    processId: process.pid,
    programs,
    startDetached: (path, args) => programs.startDetached(path, args, process.env),
    endProcess: t => process.kill(t, "SIGKILL"),
    onUncaughtException: t => process.on(Resources.uncaughtExceptionEvent, t),
    onUnhandledRejection: t => process.on(Resources.unhandledRejectionEvent, t)
  },
  import.meta.url,
  (settings, installation) => new RuntimeLauncher(settings, RuntimeBuild.identity, installation, starter),
  t => DeviceIdentity.readOrCreateAsync(t),
  t => new AppearanceStore(t),
  t => PathCommand.forBundle(t, async (program, args) => {
    await promisify(execFile)(program, [...args]);
  }),
  t => DesktopRecord.recordAsync(t, ProcessPresence.create(process.platform, new SystemCommand()), process.pid));
