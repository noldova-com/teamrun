/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import "@noldova/teamrun-foundation-core";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";
import {
  DoNotDisturbChange, type Event, Failure, FailureCode, NotificationBroadcast, NotificationState, NotificationsQuery, QualifiedName, Response, type RuntimeHandover, SettingChange, SettingKey,
  ShellEvents, ShellMethods, WindowStateKey, WindowStateValue, WindowStateWrite
} from "@noldova/teamrun-shell-protocol";
import { ConnectionException, type DataDirectory, DataDirectoryLocator, DiagnosticRedactor, LaunchSettings, RuntimeBuild, RuntimeEntry } from "@noldova/teamrun-shell-runtime";

import type { IDesktopProcess } from "../interfaces/i-desktop-process.js";
import type { IElectron } from "../interfaces/i-electron.js";
import type { IIpcEvent } from "../interfaces/i-ipc-event.js";
import type { IRuntimeLauncher } from "../interfaces/i-runtime-launcher.js";
import type { IWindowContents } from "../interfaces/i-window-contents.js";
import { StartupStateKind } from "../enums/startup-state-kind.js";
import { DesktopSettings } from "../models/desktop-settings.js";
import { MenuBar } from "../models/menu-bar.js";
import { TaskbarIdentity } from "../models/taskbar-identity.js";
import { SenderInfo } from "../models/sender-info.js";
import type { StartupState } from "../models/startup-state.js";
import { WindowAppearance } from "../models/window-appearance.js";
import { WindowState } from "../models/window-state.js";
import { Resources } from "../resources.js";
import { AppIcons } from "./app-icons.js";
import { ApplicationMenu } from "./application-menu.js";
import { DesktopLog } from "./desktop-log.js";
import { MenuBarTemplate } from "./menu-bar-template.js";
import { DeviceIdentity } from "./device-identity.js";
import { OpenWindow } from "./open-window.js";
import { RuntimeStartup } from "./runtime-startup.js";
import { RuntimeWindowStateStore } from "./runtime-window-state-store.js";
import { SenderPolicy } from "./sender-policy.js";
import { SystemNotifier } from "./system-notifier.js";
import { WindowFactory } from "./window-factory.js";
import { WindowRecovery } from "./window-recovery.js";

export class DesktopApplication {
  private static readonly EDITS: ReadonlyMap<string, (contents: IWindowContents) => void> = new Map<string, (contents: IWindowContents) => void>([
    ["undo", t => t.undo()],
    ["redo", t => t.redo()],
    ["cut", t => t.cut()],
    ["copy", t => t.copy()],
    ["paste", t => t.paste()],
    ["selectAll", t => t.selectAll()]
  ]);
  private static readonly UNOWNED_STATES: readonly StartupStateKind[] = [StartupStateKind.Connecting, StartupStateKind.PreShellData, StartupStateKind.Failed];

  private readonly electron: IElectron;
  private readonly process: IDesktopProcess;
  private readonly settings: DesktopSettings;
  private readonly taskbar: TaskbarIdentity;
  private readonly isPackaged: boolean;
  private readonly icons: AppIcons;
  private readonly dataDirectory: DataDirectory;
  private readonly log: DesktopLog;
  private readonly policy: SenderPolicy;
  private readonly factory: WindowFactory;
  private readonly startup: RuntimeStartup;
  private readonly notifier: SystemNotifier;
  private readonly readDeviceAsync: (folder: string) => Promise<string>;
  private readonly windows: Map<number, OpenWindow> = new Map();
  private readonly restored: WeakSet<OpenWindow> = new WeakSet();
  private device: Promise<string | null> = Promise.resolve(null);
  private knownDevice: string | null = null;
  private isReady: boolean = false;

  private constructor(
    electron: IElectron,
    process: IDesktopProcess,
    settings: DesktopSettings,
    taskbar: TaskbarIdentity,
    dataDirectory: DataDirectory,
    log: DesktopLog,
    launcher: IRuntimeLauncher,
    readDeviceAsync: (folder: string) => Promise<string>,
    icons: AppIcons) {
    this.electron = electron;
    this.readDeviceAsync = readDeviceAsync;
    this.process = process;
    this.settings = settings;
    this.taskbar = taskbar;
    this.isPackaged = DesktopApplication.isPackagedBuild(electron, process);
    this.icons = icons;
    this.dataDirectory = dataDirectory;
    this.log = log;
    this.policy = new SenderPolicy(settings.windowUrl);
    this.factory = new WindowFactory(settings, this.policy, electron, taskbar, icons);
    this.notifier = new SystemNotifier(electron.notifications, log, () => icons.window, () => this.isAnyWindowFocused(), t => this.openNotification(t));
    this.startup = new RuntimeStartup(launcher, t => this.publish(t), t => this.handOver(t), Resources.workWaitInterval, t => this.forward(t));
  }

  public static start(
    electron: IElectron,
    process: IDesktopProcess,
    moduleUrl: string,
    createLauncher: (settings: LaunchSettings) => IRuntimeLauncher,
    readDeviceAsync: (folder: string) => Promise<string>): void {
    const moduleDirectory = dirname(fileURLToPath(moduleUrl));
    const isPackaged = DesktopApplication.isPackagedBuild(electron, process);
    const dataDirectory = DataDirectoryLocator.locate(
      isPackaged,
      process.env,
      process.homeFolder,
      join(moduleDirectory, ...Resources.repositoryRootSegments),
      DesktopApplication.readArgument(process.argv, Resources.dataDirectoryArgument));
    if (Object.isUndefined(DesktopApplication.readArgument(process.argv, Resources.userDataArgument)))
      electron.app.setPath(Resources.userDataPath, dataDirectory.profileFolder);
    const launchSettings = new LaunchSettings(
      dataDirectory,
      process.execPath,
      RuntimeEntry.entryPath,
      { ...process.env, [Resources.runAsNodeVariable]: Resources.runAsNodeValue },
      process.platform);
    const taskbar = TaskbarIdentity.create(isPackaged, process.execPath, fileURLToPath(moduleUrl), process.argv, process.workingDirectory);
    const icons = new AppIcons(join(moduleDirectory, ...Resources.repositoryRootSegments, ...Resources.iconFolderSegments), process.platform);
    const log = new DesktopLog(dataDirectory, process.errorOutput, new DiagnosticRedactor(process.homeFolder));
    new DesktopApplication(
      electron, process, DesktopSettings.fromModule(moduleDirectory, process.platform), taskbar, dataDirectory, log, createLauncher(launchSettings), readDeviceAsync, icons).run();
  }

  private run(): void {
    const app = this.electron.app;
    app.setName(Resources.applicationName);
    app.setAppUserModelId(this.taskbar.appId);
    if (this.settings.platform === Resources.linuxPlatform)
      app.setDesktopName(`${this.taskbar.appId}${Resources.desktopFileSuffix}`);
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
    this.electron.app.dock?.setIcon(this.icons.dock);
    const deviceFolder = DesktopApplication.readArgument(this.process.argv, Resources.deviceDirectoryArgument)
      ?? DeviceIdentity.locateFolder(this.process.platform, this.process.env, this.process.homeFolder);
    this.device = this.readDeviceAsync(deviceFolder).then(t => {
      this.knownDevice = t;
      return t;
    }).catch((error: unknown) => {
      this.log.write(Resources.formatDeviceUnavailable(String(error)));
      return null;
    });
    session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.setPermissionCheckHandler(() => false);
    this.electron.ipcMain.on(Resources.readyChannel, (event, appearance) => this.show(event, appearance));
    this.electron.ipcMain.on(Resources.appearanceChannel, (event, appearance) => this.repaint(event, appearance));
    this.electron.ipcMain.on(Resources.menuBarChannel, (event, menuBar) => this.showMenuBar(event, menuBar));
    this.electron.ipcMain.handle(Resources.closeAnswerChannel, (event, requestId, isSaved) => this.answerClose(event, requestId, isSaved));
    this.electron.ipcMain.handle(Resources.readStartupChannel, event => Object.isNull(this.findTrusted(event)) ? null : this.startup.current.toJson());
    this.electron.ipcMain.handle(Resources.startupActionChannel, (event, action) => Object.isNull(this.findTrusted(event)) ? false : this.startup.actAsync(action));
    this.electron.ipcMain.handle(Resources.readLayoutChannel, event => this.readLayoutAsync(event));
    this.electron.ipcMain.handle(Resources.requestChannel, (event, method, payload) => this.requestAsync(event, method, payload));
    this.electron.ipcMain.handle(Resources.writeLayoutChannel, (event, layout) => this.writeLayoutAsync(event, layout));
    this.electron.ipcMain.handle(Resources.readBuildChannel, event => Object.isNull(this.findTrusted(event)) ? null : RuntimeBuild.identity.toJson());
    this.electron.ipcMain.handle(Resources.copyTextChannel, (event, text) => Object.isNull(this.findTrusted(event)) ? false : this.copyText(text));
    this.electron.ipcMain.handle(Resources.openLogFolderChannel, event => Object.isNull(this.findTrusted(event)) ? false : this.openLogFolderAsync());
    this.electron.ipcMain.handle(Resources.editChannel, (event, action) => this.edit(event, action));
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
    const open = new OpenWindow(window, this.electron.screen, this.log);
    window.webContents.on(Resources.didStartLoadingEvent, () => this.notifier.hold());
    new WindowRecovery(open, this.electron.dialog, this.log, this.process, () => this.electron.app.quit(), () => this.openLogFolderAsync(), Resources.reloadCrashLimit, Resources.rendererEndLimit);
    this.windows.set(contentsId, open);
    window.once(Resources.closedEvent, () => this.windows.delete(contentsId));
    open.settleWithin(Resources.connectingShowLimit);
    open.showUnpaintedWithin(Resources.paintShowLimit);
    void this.prepareAsync(open);
  }

  private publish(state: StartupState): void {
    if (!DesktopApplication.UNOWNED_STATES.includes(state.kind))
      this.log.open();
    const isReady = state.kind === StartupStateKind.Ready;
    if (isReady !== this.isReady)
      this.notifier.reset();
    this.isReady = isReady;
    for (const open of this.windows.values())
      if (!open.window.isDestroyed()) {
        open.window.webContents.send(Resources.startupStateChannel, state.toJson());
        void this.prepareAsync(open);
      }
  }

  private forward(event: Event): void {
    const payload = event.name.text === ShellEvents.notifications.text ? this.readStateForDevice(event)
      : event.name.text === ShellEvents.settingsChanged.text ? this.readSettingForDevice(event) : event.payload;
    if (Object.isUndefined(payload))
      return;
    for (const open of this.windows.values())
      if (!open.window.isDestroyed())
        open.window.webContents.send(Resources.runtimeEventChannel, event.name.text, payload);
  }

  private beginNotifier(epoch: number, device: string, response: Response): void {
    if (response.hasFailed)
      return;
    try {
      this.notifier.begin(epoch, device, NotificationState.fromJson(response.payload).sequence);
    }
    catch (error) {
      this.log.write(Resources.formatNotificationsNotRead(String(error)));
    }
  }

  private isAnyWindowFocused(): boolean {
    return [...this.windows.values()].some(t => !t.window.isDestroyed() && t.window.isFocused());
  }

  private openNotification(id: number): void {
    this.focus()?.window.webContents.send(Resources.notificationOpenedChannel, id);
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
    if (name.text === ShellMethods.notifications.text || name.text === ShellMethods.setDoNotDisturb.text)
      return await this.requestForDeviceAsync(name, value);
    if (Resources.deviceMethods.includes(name.text))
      return await this.requestSettingsForDeviceAsync(name, value);
    return (await this.callAsync(name, value)).toJson();
  }

  private readSettingForDevice(event: Event): JsonValue | undefined {
    try {
      const change = SettingChange.fromJson(event.payload);
      if (Object.isNull(change.key.device))
        return event.payload;
      return change.key.device === this.knownDevice ? new SettingChange(new SettingKey(change.key.name, change.key.scope), change.value, change.isSet).toJson() : undefined;
    }
    catch (error) {
      this.log.write(Resources.formatEventNotForwarded(event.name.text, String(error)));
      return undefined;
    }
  }

  private async requestSettingsForDeviceAsync(name: QualifiedName, value: JsonValue): Promise<JsonObject> {
    if (!Object.isObject(value) || Array.isArray(value))
      return DesktopApplication.fail(FailureCode.InvalidMessage, Resources.settingsPayloadNotObject);
    const device = await this.device;
    if (Object.isNull(device))
      return DesktopApplication.fail(FailureCode.Unavailable, Resources.settingsNeedDevice);
    return (await this.callAsync(name, { ...value, [Resources.deviceField]: device })).toJson();
  }

  private readStateForDevice(event: Event): JsonObject | undefined {
    try {
      const broadcast = NotificationBroadcast.fromJson(event.payload);
      this.notifier.receive(broadcast);
      return (Object.isNull(this.knownDevice) ? new NotificationState(broadcast.notifications, false, broadcast.sequence) : broadcast.stateFor(this.knownDevice)).toJson();
    }
    catch (error) {
      this.log.write(Resources.formatEventNotForwarded(event.name.text, String(error)));
      return undefined;
    }
  }

  private async requestForDeviceAsync(name: QualifiedName, value: JsonValue): Promise<JsonObject> {
    const epoch = this.notifier.epoch;
    const device = await this.device;
    if (Object.isNull(device))
      return DesktopApplication.fail(FailureCode.Unavailable, Resources.deviceNotIdentified);
    if (name.text === ShellMethods.notifications.text) {
      const response = await this.callAsync(name, new NotificationsQuery(device).toJson());
      this.beginNotifier(epoch, device, response);
      return response.toJson();
    }
    let isOn: boolean;
    try {
      isOn = JsonReader.fromValue(value).readBoolean(Resources.isOnField);
    }
    catch (error) {
      return DesktopApplication.fail(FailureCode.InvalidParams, String(error));
    }
    return (await this.callAsync(name, new DoNotDisturbChange(device, isOn).toJson())).toJson();
  }

  private async callAsync(method: QualifiedName, payload: JsonValue): Promise<Response> {
    const connection = this.startup.connection;
    if (Object.isNull(connection))
      return Response.failure(null, new Failure(FailureCode.Unavailable, Resources.runtimeNotConnected));
    try {
      return await connection.callAsync(method, payload);
    }
    catch (error) {
      if (!(error instanceof ConnectionException))
        throw error;
      return Response.failure(null, new Failure(FailureCode.Unavailable, error.message));
    }
  }

  private async prepareAsync(open: OpenWindow): Promise<void> {
    const kind = this.startup.current.kind;
    if (kind === StartupStateKind.Connecting)
      return;
    if (kind === StartupStateKind.Ready && this.restored.has(open))
      await open.bounds.saveUnsavedAsync().catch((error: unknown) => this.log.write(Resources.formatBoundsUnsaved(String(error))));
    else if (kind === StartupStateKind.Ready) {
      this.restored.add(open);
      const device = await this.device;
      if (!Object.isNull(device))
        await open.bounds.restoreAsync(this.createBoundsStore(device)).catch((error: unknown) => this.log.write(Resources.formatBoundsNotRestored(String(error))));
    }
    open.settle();
  }

  private async readLayoutAsync(event: IIpcEvent): Promise<JsonObject> {
    if (Object.isNull(this.findTrusted(event)))
      return DesktopApplication.fail(FailureCode.Unauthorized, Resources.untrustedRequest);
    const device = await this.device;
    if (Object.isNull(device))
      return DesktopApplication.fail(FailureCode.Unavailable, Resources.deviceNotIdentified);
    const response = await this.callAsync(ShellMethods.readWindowLayout, new WindowStateKey(device, Resources.mainWindow).toJson());
    return response.hasFailed ? response.toJson() : { [Resources.payloadField]: WindowStateValue.fromJson(response.payload).value };
  }

  private async writeLayoutAsync(event: IIpcEvent, layout: unknown): Promise<JsonObject> {
    if (Object.isNull(this.findTrusted(event)))
      return DesktopApplication.fail(FailureCode.Unauthorized, Resources.untrustedRequest);
    const value = DesktopApplication.readLayout(layout);
    if (Object.isUndefined(value))
      return DesktopApplication.fail(FailureCode.InvalidMessage, Resources.layoutNotObject);
    const device = await this.device;
    if (Object.isNull(device))
      return DesktopApplication.fail(FailureCode.Unavailable, Resources.deviceNotIdentified);
    const response = await this.callAsync(ShellMethods.writeWindowLayout, new WindowStateWrite(new WindowStateKey(device, Resources.mainWindow), value).toJson());
    return response.hasFailed ? response.toJson() : { [Resources.payloadField]: null };
  }

  private edit(event: IIpcEvent, action: unknown): boolean {
    const open = this.findTrusted(event);
    const run = Object.isString(action) ? DesktopApplication.EDITS.get(action) : undefined;
    if (Object.isNull(open) || Object.isUndefined(run))
      return false;
    run(open.window.webContents);
    return true;
  }

  private copyText(text: unknown): boolean {
    if (!Object.isString(text) || text.length > Resources.copyTextLimit)
      return false;
    this.electron.clipboard.writeText(text);
    return true;
  }

  private async openLogFolderAsync(): Promise<boolean> {
    const folder = this.dataDirectory.logsFolder;
    try {
      await mkdir(folder, { recursive: true });
    }
    catch (error) {
      this.log.write(Resources.formatLogFolderNotOpened(String(error)));
      return false;
    }
    const failure = await this.electron.shell.openPath(folder);
    if (failure.length > 0)
      this.log.write(Resources.formatLogFolderNotOpened(failure));
    return failure.length === 0;
  }

  private createBoundsStore(device: string): RuntimeWindowStateStore {
    return new RuntimeWindowStateStore(() => this.startup.connection, new WindowStateKey(device, Resources.mainWindow), ShellMethods.readWindowBounds, ShellMethods.writeWindowBounds);
  }

  private handOver(handover: RuntimeHandover): boolean {
    if (!this.isPackaged)
      return false;
    this.process.startDetached(handover.executablePath);
    this.electron.app.quit();
    return true;
  }

  private show(event: IIpcEvent, appearance: unknown): void {
    this.repaint(event, appearance)?.markPainted();
  }

  private showMenuBar(event: IIpcEvent, menuBar: unknown): void {
    if (Object.isNull(this.findTrusted(event)) || !this.settings.isMac)
      return;
    const contentsId = event.sender.id;
    try {
      const template = MenuBarTemplate.build(MenuBar.fromJson(menuBar), id => this.windows.get(contentsId)?.window.webContents.send(Resources.menuCommandChannel, id));
      this.electron.menu.setApplicationMenu(this.electron.menu.buildFromTemplate(template));
    }
    catch (error) {
      this.log.write(Resources.formatMenuBarRejected(String(error)));
    }
  }

  private repaint(event: IIpcEvent, appearance: unknown): OpenWindow | null {
    const open = this.findTrusted(event);
    if (Object.isNull(open))
      return null;
    try {
      this.factory.paint(open.window, WindowAppearance.fromJson(appearance));
    }
    catch (error) {
      this.log.write(Resources.formatAppearanceRejected(String(error)));
    }
    return open;
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

  private focus(): OpenWindow | null {
    const [open] = this.windows.values();
    if (Object.isUndefined(open))
      return null;
    if (open.window.isMinimized())
      open.window.restore();
    open.window.focus();
    return open;
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

  private static readLayout(layout: unknown): JsonObject | undefined {
    try {
      return JsonReader.fromValue(layout).toJson();
    }
    catch {
      return undefined;
    }
  }

  private static isPackagedBuild(electron: IElectron, process: IDesktopProcess): boolean {
    return electron.app.isPackaged && !process.isDefaultApp;
  }

  private static readArgument(argv: readonly string[], prefix: string): string | undefined {
    return argv.find(t => t.startsWith(prefix))?.slice(prefix.length);
  }
}
