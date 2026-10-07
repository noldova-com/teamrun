/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { devNull, homedir } from "node:os";
import { join } from "node:path";
import { isatty } from "node:tty";
import { promisify } from "node:util";

import { BrowserWindow, Menu, Notification, Tray, app, autoUpdater, clipboard, dialog, ipcMain, net, screen, session, shell, utilityProcess } from "electron";
import { AppImageUpdater, MacUpdater, NsisUpdater } from "electron-updater";
import { getAppCacheDir } from "electron-updater/out/AppAdapter.js";

import "@noldova/teamrun-foundation-core";
import {
  AppImageSource, ChildProcessStarter, FolderProtectorFactory, type Installation, ProcessPresence, ProductInfo, RuntimeBuild, RuntimeLauncher, SystemCommand, WindowsProcessApi
} from "@noldova/teamrun-shell-runtime";

import type { IUpdateHandoff } from "./interfaces/i-update-handoff.js";
import type { IUpdater } from "./interfaces/i-updater.js";
import { FeedSource } from "./models/feed-source.js";
import { Resources } from "./resources.js";
import { AppImageHandoff } from "./services/app-image-handoff.js";
import { AppImageReplacement } from "./services/app-image-replacement.js";
import { ChildProgramHost } from "./services/child-program-host.js";
import { DesktopApplication } from "./services/desktop-application.js";
import { DesktopRecord } from "./services/desktop-record.js";
import { DeviceFileStore } from "./services/device-file-store.js";
import { DeviceIdentity } from "./services/device-identity.js";
import { FeedUpdater } from "./services/feed-updater.js";
import { InstallerHandoff } from "./services/installer-handoff.js";
import { InstallerStart } from "./services/installer-start.js";
import { PathCommand } from "./services/path-command.js";
import { ProductAppAdapter } from "./services/product-app-adapter.js";
import { PublisherCheck } from "./services/publisher-check.js";
import { ShipItProcess } from "./services/ship-it-process.js";
import { SquirrelHandoff } from "./services/squirrel-handoff.js";
import { UpdateCheckLock } from "./services/update-check-lock.js";
import { UtilityProcessStarter } from "./services/utility-process-starter.js";

const starter = process.platform === Resources.windowsPlatform ? new UtilityProcessStarter(utilityProcess, process.env) : new ChildProcessStarter();
const programs = new ChildProgramHost(process.platform, Resources.programTimeout);
const presence = ProcessPresence.create(process.platform, new SystemCommand());

function createHandoff(installation: Installation, updater: IUpdater, verifyAsync: (installer: string) => Promise<string | null>, logsFolder: string, log: (text: string) => void): IUpdateHandoff {
  if (process.platform === Resources.windowsPlatform) {
    const start = new InstallerStart(starter, verifyAsync, process.env, join(logsFolder, Resources.installerErrorFile));
    const protector = FolderProtectorFactory.create(process.platform, new SystemCommand(), process.env);
    return new InstallerHandoff(installation.folder, t => protector.protectAsync(t), new WindowsProcessApi(), t => start.startAsync(t), log);
  }
  if (process.platform === Resources.macPlatform)
    return new SquirrelHandoff(updater, autoUpdater, new ShipItProcess(ProductInfo.current.applicationId, new SystemCommand()), (wait, run) => {
      const timer = setTimeout(run, wait);
      return () => clearTimeout(timer);
    }, log);
  const image = AppImageSource.find(process.env, process.execPath);
  return new AppImageHandoff(Object.isNull(image) ? null : new AppImageReplacement(image.file, log));
}

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
    nativeUpdater: autoUpdater,
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
    presence,
    isTerminal: Resources.standardDescriptors.some(t => isatty(t)),
    startDetached: (path, args, onFailure) => programs.startDetached(path, args, process.env, onFailure),
    startDetachedAsync: (path, args, environment, folder) => programs.startDetachedAsync(path, args, environment, folder),
    startApartAsync: async (path, args, environment) => {
      await new UtilityProcessStarter(utilityProcess, process.env, process.cwd()).startAsync(path, args, environment, devNull);
    },
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
  (installation, isPackaged, logsFolder, log) => {
    const product = ProductInfo.current;
    const source = FeedSource.create(product.updateFeed, product.name, process.platform, process.arch, t => net.fetch(t));
    if (Object.isNull(source))
      return null;
    const adapter = isPackaged ? undefined : new ProductAppAdapter();
    const updater = process.platform === Resources.windowsPlatform ? new NsisUpdater(undefined, adapter)
      : process.platform === Resources.macPlatform ? new MacUpdater(undefined, adapter) : new AppImageUpdater(undefined, adapter);
    const check = new PublisherCheck(product.windowsPublisher, new WindowsProcessApi(), log, Date.now);
    const feed = new FeedUpdater(updater, source, installation.folder, getAppCacheDir(), product.slug, updater instanceof NsisUpdater ? t => check.checkAsync(t) : null, log);
    return { updater: feed, handoff: createHandoff(installation, feed, t => check.checkAsync(t), logsFolder, log) };
  },
  (installation, log) => new UpdateCheckLock(installation.folder, async () => (await presence.stampAsync([[process.pid, Resources.clientName]]))[0] ?? null, t => presence.isRunningAsync(t), log));
