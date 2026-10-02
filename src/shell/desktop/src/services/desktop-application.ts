/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import "@noldova/teamrun-foundation-core";
import { type RuntimeHandover, ShellMethods, WindowStateKey } from "@noldova/teamrun-shell-protocol";
import { DataDirectoryLocator, LaunchSettings, RuntimeEntry } from "@noldova/teamrun-shell-runtime";

import type { IDesktopProcess } from "../interfaces/i-desktop-process.js";
import type { IElectron } from "../interfaces/i-electron.js";
import type { IIpcEvent } from "../interfaces/i-ipc-event.js";
import type { IRuntimeLauncher } from "../interfaces/i-runtime-launcher.js";
import { StartupStateKind } from "../enums/startup-state-kind.js";
import { DesktopSettings } from "../models/desktop-settings.js";
import { SenderInfo } from "../models/sender-info.js";
import type { StartupState } from "../models/startup-state.js";
import { WindowAppearance } from "../models/window-appearance.js";
import { WindowState } from "../models/window-state.js";
import { Resources } from "../resources.js";
import { ApplicationMenu } from "./application-menu.js";
import { DeviceIdentity } from "./device-identity.js";
import { OpenWindow } from "./open-window.js";
import { RuntimeStartup } from "./runtime-startup.js";
import { RuntimeWindowStateStore } from "./runtime-window-state-store.js";
import { SenderPolicy } from "./sender-policy.js";
import { WindowFactory } from "./window-factory.js";

export class DesktopApplication {
  private readonly electron: IElectron;
  private readonly process: IDesktopProcess;
  private readonly settings: DesktopSettings;
  private readonly policy: SenderPolicy;
  private readonly factory: WindowFactory;
  private readonly startup: RuntimeStartup;
  private readonly readDeviceAsync: (folder: string) => Promise<string>;
  private readonly windows: Map<number, OpenWindow> = new Map();
  private readonly restored: WeakSet<OpenWindow> = new WeakSet();
  private device: Promise<string | null> = Promise.resolve(null);

  private constructor(electron: IElectron, process: IDesktopProcess, settings: DesktopSettings, launcher: IRuntimeLauncher, readDeviceAsync: (folder: string) => Promise<string>) {
    this.electron = electron;
    this.readDeviceAsync = readDeviceAsync;
    this.process = process;
    this.settings = settings;
    this.policy = new SenderPolicy(settings.windowUrl);
    this.factory = new WindowFactory(settings, this.policy, electron);
    this.startup = new RuntimeStartup(launcher, t => this.publish(t), t => this.handOver(t), Resources.workWaitInterval);
  }

  public static start(
    electron: IElectron,
    process: IDesktopProcess,
    moduleUrl: string,
    createLauncher: (settings: LaunchSettings) => IRuntimeLauncher,
    readDeviceAsync: (folder: string) => Promise<string>): void {
    const moduleDirectory = dirname(fileURLToPath(moduleUrl));
    const dataDirectory = DataDirectoryLocator.locate(
      electron.app.isPackaged,
      process.env,
      process.homeFolder,
      join(moduleDirectory, ...Resources.repositoryRootSegments),
      DesktopApplication.readArgument(process.argv, Resources.dataDirectoryArgument));
    if (Object.isUndefined(DesktopApplication.readArgument(process.argv, Resources.userDataArgument)))
      electron.app.setPath(Resources.userDataPath, join(dataDirectory.root, Resources.profileFolder));
    const launchSettings = new LaunchSettings(
      dataDirectory,
      process.execPath,
      RuntimeEntry.entryPath,
      { ...process.env, [Resources.runAsNodeVariable]: Resources.runAsNodeValue },
      process.platform);
    new DesktopApplication(electron, process, DesktopSettings.fromModule(moduleDirectory, process.platform), createLauncher(launchSettings), readDeviceAsync).run();
  }

  private run(): void {
    const app = this.electron.app;
    app.setName(Resources.applicationName);
    app.setAppUserModelId(Resources.appUserModelId);
    if (!app.requestSingleInstanceLock()) {
      app.quit();
      return;
    }
    app.enableSandbox();
    app.on(Resources.secondInstanceEvent, () => this.focus());
    app.on(Resources.windowAllClosedEvent, () => app.quit());
    app.on(Resources.willQuitEvent, () => this.startup.close());
    void app.whenReady().then(() => this.ready());
  }

  private ready(): void {
    const session = this.electron.session.defaultSession;
    ApplicationMenu.install(this.electron.menu, this.settings);
    const deviceFolder = DesktopApplication.readArgument(this.process.argv, Resources.deviceDirectoryArgument)
      ?? DeviceIdentity.locateFolder(this.process.platform, this.process.env, this.process.homeFolder);
    this.device = this.readDeviceAsync(deviceFolder).catch((error: unknown) => {
      process.stderr.write(`${Resources.formatDeviceUnavailable(String(error))}\n`);
      return null;
    });
    session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.setPermissionCheckHandler(() => false);
    this.electron.ipcMain.on(Resources.readyChannel, (event, appearance) => this.show(event, appearance));
    this.electron.ipcMain.handle(Resources.closeAnswerChannel, (event, requestId, isSaved) => this.answerClose(event, requestId, isSaved));
    this.electron.ipcMain.handle(Resources.readStartupChannel, event => Object.isNull(this.findTrusted(event)) ? null : this.startup.current.toJson());
    this.electron.ipcMain.handle(Resources.startupActionChannel, (event, action) => Object.isNull(this.findTrusted(event)) ? false : this.startup.actAsync(action));
    this.electron.app.on(Resources.activateEvent, () => {
      if (this.windows.size === 0)
        this.open();
    });
    this.open();
    void this.startup.startAsync();
  }

  private open(): void {
    const window = this.factory.create(WindowState.createDefault());
    const contentsId = window.webContents.id;
    const open = new OpenWindow(window, this.electron.screen);
    this.windows.set(contentsId, open);
    window.once(Resources.closedEvent, () => this.windows.delete(contentsId));
    void this.prepareAsync(open);
  }

  private publish(state: StartupState): void {
    for (const open of this.windows.values())
      if (!open.window.isDestroyed()) {
        open.window.webContents.send(Resources.startupStateChannel, state.toJson());
        void this.prepareAsync(open);
      }
  }

  private async prepareAsync(open: OpenWindow): Promise<void> {
    const kind = this.startup.current.kind;
    if (kind === StartupStateKind.Connecting)
      return;
    if (kind === StartupStateKind.Ready && !this.restored.has(open)) {
      this.restored.add(open);
      const device = await this.device;
      if (!Object.isNull(device))
        await open.bounds.restoreAsync(new RuntimeWindowStateStore(
          () => this.startup.connection,
          new WindowStateKey(device, Resources.mainWindow),
          ShellMethods.readWindowBounds,
          ShellMethods.writeWindowBounds)).catch((error: unknown) => process.stderr.write(`${Resources.formatBoundsNotRestored(String(error))}\n`));
    }
    open.settle();
  }

  private handOver(handover: RuntimeHandover): boolean {
    if (!this.electron.app.isPackaged)
      return false;
    this.process.startDetached(handover.executablePath);
    this.electron.app.quit();
    return true;
  }

  private show(event: IIpcEvent, appearance: unknown): void {
    const open = this.findTrusted(event);
    if (Object.isNull(open))
      return;
    try {
      this.factory.paint(open.window, WindowAppearance.fromJson(appearance));
    }
    catch (error) {
      process.stderr.write(`${Resources.formatAppearanceRejected(String(error))}\n`);
    }
    open.markPainted();
  }

  private answerClose(event: IIpcEvent, requestId: unknown, isSaved: unknown): boolean {
    return this.findTrusted(event)?.coordinator.answer(requestId, isSaved) ?? false;
  }

  private findTrusted(event: IIpcEvent): OpenWindow | null {
    const frame = event.senderFrame;
    if (Object.isNull(frame) || !this.policy.isTrusted(new SenderInfo(frame.url, Object.isNull(frame.parent), event.sender.id)))
      return null;
    return this.windows.get(event.sender.id) ?? null;
  }

  private focus(): void {
    const [open] = this.windows.values();
    if (Object.isUndefined(open))
      return;
    if (open.window.isMinimized())
      open.window.restore();
    open.window.focus();
  }

  private static readArgument(argv: readonly string[], prefix: string): string | undefined {
    return argv.find(t => t.startsWith(prefix))?.slice(prefix.length);
  }
}
