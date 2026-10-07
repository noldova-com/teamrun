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

import { BrowserWindow, Menu, Notification, Tray, app, clipboard, dialog, ipcMain, net, screen, session, shell, utilityProcess } from "electron";
import { AppImageUpdater, MacUpdater, NsisUpdater } from "electron-updater";
import { getAppCacheDir } from "electron-updater/out/AppAdapter.js";
import { verifySignature } from "electron-updater/out/windowsExecutableCodeSignatureVerifier.js";

import "@noldova/teamrun-foundation-core";
import { ChildProcessStarter, ProcessPresence, ProductInfo, RuntimeBuild, RuntimeLauncher, SystemCommand } from "@noldova/teamrun-shell-runtime";

import { FeedSource } from "./models/feed-source.js";
import { Resources } from "./resources.js";
import { ChildProgramHost } from "./services/child-program-host.js";
import { DesktopApplication } from "./services/desktop-application.js";
import { DesktopRecord } from "./services/desktop-record.js";
import { DeviceFileStore } from "./services/device-file-store.js";
import { DeviceIdentity } from "./services/device-identity.js";
import { FeedUpdater } from "./services/feed-updater.js";
import { PathCommand } from "./services/path-command.js";
import { PublisherCheck } from "./services/publisher-check.js";
import { UpdateCheckLock } from "./services/update-check-lock.js";
import { UtilityProcessStarter } from "./services/utility-process-starter.js";

const starter = process.platform === Resources.windowsPlatform ? new UtilityProcessStarter(utilityProcess) : new ChildProcessStarter();
const programs = new ChildProgramHost(process.platform, Resources.programTimeout);
const presence = ProcessPresence.create(process.platform, new SystemCommand());

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
    startDetached: (path, args, onFailure) => programs.startDetached(path, args, process.env, onFailure),
    endProcess: t => process.kill(t, "SIGKILL"),
    onUncaughtException: t => process.on(Resources.uncaughtExceptionEvent, t),
    onUnhandledRejection: t => process.on(Resources.unhandledRejectionEvent, t)
  },
  import.meta.url,
  (settings, installation) => new RuntimeLauncher(settings, RuntimeBuild.identity, installation, starter),
  t => DeviceIdentity.readOrCreateAsync(t),
  (folder, fileName) => new DeviceFileStore(folder, fileName),
  t => PathCommand.forBundle(t, async (program, args) => {
    await promisify(execFile)(program, [...args]);
  }),
  t => DesktopRecord.recordAsync(t, presence, process.pid),
  (installation, log) => {
    const product = ProductInfo.current;
    const source = FeedSource.create(product.updateFeed, product.name, process.platform, process.arch, t => net.fetch(t));
    if (Object.isNull(source))
      return null;
    const updater = process.platform === Resources.windowsPlatform ? new NsisUpdater() : process.platform === Resources.macPlatform ? new MacUpdater() : new AppImageUpdater();
    const check = new PublisherCheck(product.windowsPublisher, verifySignature, log, Date.now);
    return new FeedUpdater(updater, source, installation.folder, getAppCacheDir(), product.slug, updater instanceof NsisUpdater ? t => check.checkAsync(t) : null, log);
  },
  (installation, log) => new UpdateCheckLock(installation.folder, async () => (await presence.stampAsync([[process.pid, Resources.clientName]]))[0] ?? null, t => presence.isRunningAsync(t), log));
