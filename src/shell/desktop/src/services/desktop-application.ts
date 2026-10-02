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
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";
import { type Event, Failure, FailureCode, QualifiedName, Response, type RuntimeHandover, ShellMethods, WindowStateKey } from "@noldova/teamrun-shell-protocol";
import { ConnectionException, DataDirectoryLocator, LaunchSettings, RuntimeEntry } from "@noldova/teamrun-shell-runtime";

import type { IDesktopProcess } from "../interfaces/i-desktop-process.js";
import type { IElectron } from "../interfaces/i-electron.js";
import type { IIpcEvent } from "../interfaces/i-ipc-event.js";
import type { IRuntimeLauncher } from "../interfaces/i-runtime-launcher.js";
import { StartupStateKind } from "../enums/startup-state-kind.js";
import { WindowStateException } from "../exceptions/window-state.exception.js";
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
    this.startup = new RuntimeStartup(launcher, t => this.publish(t), t => this.handOver(t), Resources.workWaitInterval, t => this.forward(t));
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
    this.electron.ipcMain.handle(Resources.readLayoutChannel, event => Object.isNull(this.findTrusted(event)) ? null : this.readLayoutAsync());
    this.electron.ipcMain.handle(Resources.requestChannel, (event, method, payload) => this.requestAsync(event, method, payload));
    this.electron.ipcMain.handle(Resources.writeLayoutChannel, (event, layout) => Object.isNull(this.findTrusted(event)) ? false : this.writeLayoutAsync(layout));
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

  private forward(event: Event): void {
    for (const open of this.windows.values())
      if (!open.window.isDestroyed())
        open.window.webContents.send(Resources.runtimeEventChannel, event.name.text, event.payload);
  }

  private async requestAsync(event: IIpcEvent, method: unknown, payload: unknown): Promise<JsonObject> {
    if (Object.isNull(this.findTrusted(event)))
      return DesktopApplication.fail(FailureCode.Unauthorized, Resources.untrustedRequest);
    const name = DesktopApplication.readMethod(method);
    if (Object.isNull(name))
      return DesktopApplication.fail(FailureCode.InvalidMessage, Resources.methodNotText);
    const value = DesktopApplication.readPayload(payload);
    if (Object.isUndefined(value))
      return DesktopApplication.fail(FailureCode.InvalidMessage, Resources.payloadNotJson);
    if (name.owner === Resources.shellOwner && !Resources.windowShellMethods.includes(name.text))
      return DesktopApplication.fail(FailureCode.Unauthorized, Resources.formatMethodRefused(name.text));
    const connection = this.startup.connection;
    if (Object.isNull(connection))
      return DesktopApplication.fail(FailureCode.Unavailable, Resources.runtimeNotConnected);
    try {
      return (await connection.callAsync(name, value)).toJson();
    }
    catch (error) {
      if (!(error instanceof ConnectionException))
        throw error;
      return DesktopApplication.fail(FailureCode.Unavailable, error.message);
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
        await open.bounds.restoreAsync(this.createStore(device, ShellMethods.readWindowBounds, ShellMethods.writeWindowBounds)).catch((error: unknown) => process.stderr.write(`${Resources.formatBoundsNotRestored(String(error))}\n`));
    }
    open.settle();
  }

  private async readLayoutAsync(): Promise<JsonObject | null> {
    return await (await this.createLayoutStoreAsync()).readAsync();
  }

  private async writeLayoutAsync(layout: unknown): Promise<boolean> {
    const value = JsonReader.fromValue(layout).toJson();
    await (await this.createLayoutStoreAsync()).writeAsync(value);
    return true;
  }

  private async createLayoutStoreAsync(): Promise<RuntimeWindowStateStore> {
    const device = await this.device;
    if (Object.isNull(device))
      throw new WindowStateException(Resources.deviceNotIdentified);
    return this.createStore(device, ShellMethods.readWindowLayout, ShellMethods.writeWindowLayout);
  }

  private createStore(device: string, readMethod: QualifiedName, writeMethod: QualifiedName): RuntimeWindowStateStore {
    return new RuntimeWindowStateStore(() => this.startup.connection, new WindowStateKey(device, Resources.mainWindow), readMethod, writeMethod);
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

  private static fail(code: FailureCode, message: string): JsonObject {
    return Response.failure(null, new Failure(code, message)).toJson();
  }

  private static readMethod(method: unknown): QualifiedName | null {
    if (!Object.isString(method))
      return null;
    try {
      return QualifiedName.parse(method, Resources.methodParameter);
    }
    catch {
      return null;
    }
  }

  private static readPayload(payload: unknown): JsonValue | undefined {
    try {
      return JsonReader.toJsonValue(payload);
    }
    catch {
      return undefined;
    }
  }

  private static readArgument(argv: readonly string[], prefix: string): string | undefined {
    return argv.find(t => t.startsWith(prefix))?.slice(prefix.length);
  }
}
