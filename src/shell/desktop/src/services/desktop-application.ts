/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import type { MessageBoxOptions } from "electron";

import "@noldova/teamrun-foundation-core";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";
import {
  type Event, Failure, FailureCode, NotificationBroadcast, NotificationState, NotificationsQuery, QualifiedName, RecentCommands, Response, type RuntimeHandover, SettingChange, SettingKey,
  SettingValue, ShellEvents, ShellMethods, StopPolicy, StopRequest, WindowStateKey, WindowStateValue, WindowStateWrite, WorkReport
} from "@noldova/teamrun-shell-protocol";
import {
  AppImageSource,
  ConnectionException,
  type DataDirectory,
  DataDirectoryLocator,
  DeviceFolder,
  DiagnosticRedactor,
  Installation,
  LaunchSettings,
  LogText,
  ProcessPresence,
  RuntimeBuild,
  RuntimeEntry,
  ShellSettings,
  SystemCommand
} from "@noldova/teamrun-shell-runtime";

import { PathCommandException } from "../exceptions/path-command.exception.js";
import { WindowStateUnavailableException } from "../exceptions/window-state-unavailable.exception.js";
import type { IContextMenuParams } from "../interfaces/i-context-menu-params.js";
import type { IDesktopProcess } from "../interfaces/i-desktop-process.js";
import type { IAppearanceStore } from "../interfaces/i-appearance-store.js";
import type { IElectron } from "../interfaces/i-electron.js";
import type { IIpcEvent } from "../interfaces/i-ipc-event.js";
import type { IQuitPrompt } from "../interfaces/i-quit-prompt.js";
import type { IRuntimeLauncher } from "../interfaces/i-runtime-launcher.js";
import type { IUpdateHost } from "../interfaces/i-update-host.js";
import type { IWindowContents } from "../interfaces/i-window-contents.js";
import { MainProcessFailureKind } from "../enums/main-process-failure-kind.js";
import { PathCommandOutcome } from "../enums/path-command-outcome.js";
import { StartupStateKind } from "../enums/startup-state-kind.js";
import { WindowErrorAdmission } from "../enums/window-error-admission.js";
import { DesktopSettings } from "../models/desktop-settings.js";
import { MenuBar } from "../models/menu-bar.js";
import { ScreenArea } from "../models/screen-area.js";
import { TaskbarIdentity } from "../models/taskbar-identity.js";
import { SenderInfo } from "../models/sender-info.js";
import type { StartupState } from "../models/startup-state.js";
import { WindowAppearance } from "../models/window-appearance.js";
import { WindowState } from "../models/window-state.js";
import { Resources } from "../resources.js";
import { AppIcons } from "./app-icons.js";
import { ApplicationMenu } from "./application-menu.js";
import { DesktopLog } from "./desktop-log.js";
import { DeviceSettingFollower } from "./device-setting-follower.js";
import { MenuBarTemplate } from "./menu-bar-template.js";
import { LinkPolicy } from "./link-policy.js";
import { MainProcessRecovery } from "./main-process-recovery.js";
import { OpenWindow } from "./open-window.js";
import type { PathCommand } from "./path-command.js";
import { QuitCoordinator } from "./quit-coordinator.js";
import { RuntimeStartup } from "./runtime-startup.js";
import { RuntimeWindowStateStore } from "./runtime-window-state-store.js";
import { SenderPolicy } from "./sender-policy.js";
import { SpellChecker } from "./spell-checker.js";
import { SpellingDictionaries } from "./spelling-dictionaries.js";
import { SystemNotifier } from "./system-notifier.js";
import { TrayController } from "./tray-controller.js";
import { TrayHostWatcher } from "./tray-host-watcher.js";
import { UpdateBarrierGate } from "./update-barrier-gate.js";
import { UpdateBarrierWatch } from "./update-barrier-watch.js";
import { WindowFactory } from "./window-factory.js";
import { WindowRecovery } from "./window-recovery.js";

export class DesktopApplication {
  private static readonly EDITS: ReadonlyMap<string, (contents: IWindowContents) => void> = new Map<string, (contents: IWindowContents) => void>([
    ["Undo", t => t.undo()],
    ["Redo", t => t.redo()],
    ["Cut", t => t.cut()],
    ["Copy", t => t.copy()],
    ["Paste", t => t.paste()],
    ["SelectAll", t => t.selectAll()]
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
  private readonly watch: UpdateBarrierWatch;
  private readonly recordDesktopAsync: () => Promise<boolean>;
  private readonly gate: UpdateBarrierGate;
  private readonly notifier: SystemNotifier;
  private readonly quit: QuitCoordinator;
  private readonly tray: TrayController;
  private readonly trayHosts: TrayHostWatcher;
  private readonly trayIcon: DeviceSettingFollower;
  private readonly spelling: SpellChecker;
  private readonly readDeviceAsync: (folder: string) => Promise<string>;
  private readonly deviceFolder: string;
  private readonly appearanceStore: IAppearanceStore;
  private readonly createPathCommand: (executablePath: string) => PathCommand;
  private appearance: JsonObject | null = null;
  private readonly windows: Map<number, OpenWindow> = new Map();
  private readonly restored: WeakSet<OpenWindow> = new WeakSet();
  private device: Promise<string | null> = Promise.resolve(null);
  private knownDevice: string | null = null;
  private isReady: boolean = false;
  private hasPassedBarrier: boolean = false;

  private constructor(
    electron: IElectron,
    process: IDesktopProcess,
    settings: DesktopSettings,
    taskbar: TaskbarIdentity,
    dataDirectory: DataDirectory,
    log: DesktopLog,
    launcher: IRuntimeLauncher,
    readDeviceAsync: (folder: string) => Promise<string>,
    createAppearanceStore: (folder: string) => IAppearanceStore,
    createPathCommand: (executablePath: string) => PathCommand,
    icons: AppIcons,
    spelling: SpellChecker,
    installation: Installation,
    recordDesktopAsync: () => Promise<boolean>) {
    this.electron = electron;
    this.createPathCommand = createPathCommand;
    this.readDeviceAsync = readDeviceAsync;
    this.deviceFolder = DesktopApplication.locateDeviceFolder(process);
    this.appearanceStore = createAppearanceStore(this.deviceFolder);
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
    this.gate = new UpdateBarrierGate(installation, RuntimeBuild.identity.productVersion, electron.dialog, t => log.write(t));
    const updates: IUpdateHost = {
      processId: process.processId,
      readBarrierAsync: () => installation.readAsync(),
      hasUpdateEndedAsync: () => installation.hasEndedAsync(),
      saveAsync: () => this.saveForUpdateAsync(),
      quit: () => electron.app.exit(Resources.quitExitCode)
    };
    this.startup = new RuntimeStartup(launcher, t => this.publish(t), t => this.handOver(t), Resources.workWaitInterval, t => this.forward(t), t => this.log.write(t), Date.now, (t, signal) => delay(t, undefined, { signal }), updates);
    this.watch = new UpdateBarrierWatch(updates, () => !Object.isNull(this.startup.connection), Resources.updateBarrierInterval);
    this.recordDesktopAsync = recordDesktopAsync;
    this.quit = new QuitCoordinator(t => this.isLastOpen(t), () => this.readWorkAsync(), () => this.stopWorkAsync());
    this.tray = new TrayController(electron.tray, electron.menu, icons, process.platform,
      { open: () => this.reopen(), openNotification: t => this.openNotification(t), setDoNotDisturb: t => void this.setDoNotDisturbAsync(t), quit: () => electron.app.quit() }, t => this.log.write(t));
    this.trayHosts = new TrayHostWatcher(process.platform, process.programs, process.env, t => delay(t, undefined, { ref: false }), t => this.tray.setHostAvailable(t));
    this.trayIcon = new DeviceSettingFollower(ShellSettings.trayIcon, process.platform !== Resources.macPlatform, t => this.callAsync(ShellMethods.readSetting, t.toJson()),
      t => this.tray.setEnabled(t === true), t => this.log.write(t));
    this.spelling = spelling;
  }

  public static start(
    electron: IElectron,
    process: IDesktopProcess,
    moduleUrl: string,
    createLauncher: (settings: LaunchSettings, installation: Installation) => IRuntimeLauncher,
    readDeviceAsync: (folder: string) => Promise<string>,
    createAppearanceStore: (folder: string) => IAppearanceStore,
    createPathCommand: (executablePath: string) => PathCommand,
    recordDesktopAsync: (installation: Installation) => Promise<boolean>): void {
    const redactor = new DiagnosticRedactor(process.homeFolder);
    const recovery = new MainProcessRecovery(electron.app, electron.dialog, process.errorOutput, redactor);
    process.onUncaughtException(t => recovery.receive(t, MainProcessFailureKind.UncaughtException));
    process.onUnhandledRejection(t => recovery.receive(t, MainProcessFailureKind.UnhandledRejection));
    electron.app.setName(Resources.applicationName);
    const moduleDirectory = dirname(fileURLToPath(moduleUrl));
    const isPackaged = DesktopApplication.isPackagedBuild(electron, process);
    const dataDirectory = DataDirectoryLocator.locate(
      isPackaged,
      process.env,
      process.homeFolder,
      join(moduleDirectory, ...Resources.repositoryRootSegments),
      DesktopApplication.readArgument(process.argv, Resources.dataDirectoryArgument));
    const userData = DesktopApplication.readArgument(process.argv, Resources.userDataArgument);
    if (Object.isUndefined(userData))
      electron.app.setPath(Resources.userDataPath, dataDirectory.profileFolder);
    const launchSettings = new LaunchSettings(
      dataDirectory,
      process.execPath,
      RuntimeEntry.entryPath,
      { ...process.env, [Resources.runAsNodeVariable]: Resources.runAsNodeValue },
      process.platform);
    const presence = ProcessPresence.create(process.platform, new SystemCommand());
    const installation = new Installation(
      Installation.locate(DesktopApplication.locateDeviceFolder(process), AppImageSource.locateProgram(process.env, process.execPath), process.platform), t => presence.isRunningAsync(t));
    const icons = new AppIcons(join(moduleDirectory, ...Resources.repositoryRootSegments, ...Resources.iconFolderSegments), process.platform);
    const taskbar = TaskbarIdentity.create(isPackaged, process.execPath, icons.window, fileURLToPath(moduleUrl), process.argv, process.workingDirectory);
    const log = new DesktopLog(dataDirectory, process.errorOutput, redactor);
    const profileFolder = userData ?? dataDirectory.profileFolder;
    const languages = process.platform === Resources.macPlatform
      ? []
      : SpellingDictionaries.install(join(moduleDirectory, ...Resources.repositoryRootSegments, ...Resources.dictionaryFolderSegments), profileFolder, t => log.write(t));
    const spelling = new SpellChecker(
      () => electron.session.defaultSession, languages, SpellingDictionaries.addressOf(profileFolder), process.platform, () => electron.app.getPreferredSystemLanguages(), t => log.write(t));
    const application = new DesktopApplication(
      electron, process, DesktopSettings.fromModule(moduleDirectory, process.platform), taskbar, dataDirectory, log, createLauncher(launchSettings, installation), readDeviceAsync, createAppearanceStore, createPathCommand, icons,
      spelling, installation, () => recordDesktopAsync(installation));
    recovery.attach(log, () => application.openLogFolderAsync());
    application.run();
  }

  private run(): void {
    const app = this.electron.app;
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
    app.on(Resources.willQuitEvent, () => {
      this.watch.stop();
      this.trayHosts.stop();
      this.tray.dispose();
      this.startup.close();
    });
    void app.whenReady().then(() => this.ready());
  }

  private async passBarrierAsync(pass: () => Promise<boolean>): Promise<boolean> {
    try {
      return await pass();
    }
    catch (error) {
      this.log.write(Resources.formatBarrierUnsettled(String(error)));
      return false;
    }
  }

  private ready(): void {
    this.spelling.start();
    const session = this.electron.session.defaultSession;
    ApplicationMenu.install(this.electron.menu, this.settings);
    this.electron.app.dock?.setIcon(this.icons.dock);
    this.device = this.readDeviceAsync(this.deviceFolder).then(t => {
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
    this.electron.ipcMain.on(Resources.keepAppearanceChannel, (event, preferences) => this.keepAppearance(event, preferences));
    this.electron.ipcMain.handle(Resources.readSpellingChannel, event => Object.isNull(this.findTrusted(event)) ? null : this.spelling.toJson());
    this.electron.ipcMain.on(Resources.spellingChannel, (event, isChecking, languages) => this.keepSpelling(event, isChecking, languages));
    this.electron.ipcMain.handle(Resources.replaceMisspellingChannel, (event, text) => this.replaceMisspelling(event, text));
    this.electron.ipcMain.on(Resources.menuBarChannel, (event, menuBar) => this.showMenuBar(event, menuBar));
    this.electron.ipcMain.handle(Resources.closeAnswerChannel, (event, requestId, isSaved) => this.answerClose(event, requestId, isSaved));
    this.electron.ipcMain.handle(Resources.updateSaveAnswerChannel, (event, requestId, problems) => this.findTrusted(event)?.updateSaves.answer(requestId, problems) ?? false);
    this.electron.ipcMain.handle(Resources.quitAnswerChannel, (event, choice) => this.answerQuit(event, choice));
    this.electron.ipcMain.on(Resources.moduleLogChannel, (event, moduleId, message) => this.writeModuleLog(event, moduleId, message));
    this.electron.ipcMain.on(Resources.windowErrorChannel, (event, moduleId, text) => this.writeWindowError(event, moduleId, text));
    this.electron.ipcMain.handle(Resources.readStartupChannel, event => Object.isNull(this.findTrusted(event)) ? null : this.startup.current.toJson());
    this.electron.ipcMain.handle(Resources.startupActionChannel, (event, action) => Object.isNull(this.findTrusted(event)) ? false : this.startup.actAsync(action));
    this.electron.ipcMain.handle(Resources.readLayoutChannel, event => this.readLayoutAsync(event));
    this.electron.ipcMain.handle(Resources.requestChannel, (event, method, payload) => this.requestAsync(event, method, payload));
    this.electron.ipcMain.handle(Resources.writeLayoutChannel, (event, layout) => this.writeLayoutAsync(event, layout));
    this.electron.ipcMain.handle(Resources.readBuildChannel, event => Object.isNull(this.findTrusted(event)) ? null : RuntimeBuild.identity.toJson());
    this.electron.ipcMain.handle(Resources.copyTextChannel, (event, text) => Object.isNull(this.findTrusted(event)) ? false : this.copyText(text));
    this.electron.ipcMain.handle(Resources.openLogFolderChannel, event => Object.isNull(this.findTrusted(event)) ? false : this.openLogFolderAsync());
    this.electron.ipcMain.handle(Resources.openLinkChannel, (event, url) => Object.isNull(this.findTrusted(event)) ? false : this.openLinkAsync(url));
    this.electron.ipcMain.handle(Resources.installCommandChannel, event => this.installCommandAsync(event));
    this.electron.ipcMain.handle(Resources.editChannel, (event, action) => this.edit(event, action));
    this.electron.app.on(Resources.activateEvent, () => {
      if (this.hasPassedBarrier && this.windows.size === 0)
        this.open();
    });
    void Promise.all([this.passBarrierAsync(() => this.gate.passAsync()), this.readAppearanceAsync(), this.recordSelfAsync()]).then(([isClear]) => {
      if (!isClear) {
        this.electron.app.exit(Resources.quitExitCode);
        return;
      }
      this.hasPassedBarrier = true;
      this.tray.setHostAvailable(this.trayHosts.isAvailable);
      this.tray.setEnabled(this.trayIcon.value === true);
      this.trayHosts.start();
      this.open();
      this.watch.start();
      void this.startup.startAsync();
    });
  }

  private async recordSelfAsync(): Promise<void> {
    try {
      if (!await this.recordDesktopAsync())
        this.log.write(Resources.formatDesktopUnrecorded(Resources.updateHolderNotFound));
    }
    catch (error) {
      this.log.write(Resources.formatDesktopUnrecorded(String(error)));
    }
  }

  private async readAppearanceAsync(): Promise<void> {
    try {
      this.appearance = await this.appearanceStore.readAsync();
    }
    catch (error) {
      this.log.write(Resources.formatAppearanceUnread(String(error)));
    }
  }

  private keepAppearance(event: IIpcEvent, preferences: unknown): void {
    if (Object.isNull(this.findTrusted(event)))
      return;
    let json: JsonObject;
    try {
      json = JsonReader.fromValue(preferences).toJson();
    }
    catch (error) {
      this.log.write(Resources.formatPreferencesRejected(String(error)));
      return;
    }
    if (JSON.stringify(json).length > Resources.appearanceLimit) {
      this.log.write(Resources.formatPreferencesRejected(Resources.appearanceTooLarge));
      return;
    }
    this.appearance = json;
    this.appearanceStore.writeAsync(json).catch((error: unknown) => this.log.write(Resources.formatAppearanceUnsaved(String(error))));
  }

  private keepSpelling(event: IIpcEvent, isChecking: unknown, languages: unknown): void {
    if (Object.isNull(this.findTrusted(event)))
      return;
    if (!Object.isBoolean(isChecking) || !Array.isArray(languages) || !languages.every(t => Object.isString(t))) {
      this.log.write(Resources.formatSpellingRejected(Resources.spellingInvalid));
      return;
    }
    this.spelling.apply(isChecking, languages);
  }

  private replaceMisspelling(event: IIpcEvent, text: unknown): boolean {
    const open = this.findTrusted(event);
    if (Object.isNull(open) || !Object.isString(text) || text.length === 0 || text.length > Resources.spellingTextLimit)
      return false;
    open.window.webContents.replaceMisspelling(text);
    return true;
  }

  private forwardFieldMenu(open: OpenWindow, params: IContextMenuParams): void {
    open.window.webContents.send(Resources.fieldMenuChannel, {
      [Resources.xField]: params.x,
      [Resources.yField]: params.y,
      [Resources.isKeyboardField]: params.menuSourceType === Resources.keyboardMenuSource,
      [Resources.wordField]: params.misspelledWord,
      [Resources.suggestionsField]: [...params.dictionarySuggestions]
    });
  }

  private open(): void {
    const window = this.factory.create(WindowState.createDefault(ScreenArea.of(this.electron.screen.getPrimaryDisplay().workArea)), this.appearance);
    const contentsId = window.webContents.id;
    const open = new OpenWindow(window, this.electron.screen, this.log, this.quit, this.settings.platform);
    window.webContents.on(Resources.didStartLoadingEvent, () => this.notifier.hold());
    window.webContents.on(Resources.contextMenuEvent, (_event, params) => this.forwardFieldMenu(open, params));
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
    if (!isReady)
      this.quit.release();
    if (isReady && !this.isReady)
      void this.refreshTrayAsync();
    else if (!isReady)
      this.tray.clear();
    this.isReady = isReady;
    for (const open of this.windows.values())
      if (!open.window.isDestroyed()) {
        open.window.webContents.send(Resources.startupStateChannel, state.toJson());
        void this.prepareAsync(open);
      }
  }

  private forward(event: Event): void {
    if (event.name.text === ShellEvents.work.text)
      this.receiveWork(event);
    const payload = event.name.text === ShellEvents.notifications.text ? this.readStateForDevice(event)
      : event.name.text === ShellEvents.settingsChanged.text ? this.readSettingForDevice(event)
        : event.name.text === ShellEvents.recentCommandsChanged.text ? this.readRecentCommandsForDevice(event) : event.payload;
    if (Object.isUndefined(payload))
      return;
    for (const open of this.windows.values())
      if (!open.window.isDestroyed())
        open.window.webContents.send(Resources.runtimeEventChannel, event.name.text, payload);
  }

  private receiveWork(event: Event): void {
    try {
      const report = WorkReport.fromJson(event.payload);
      this.quit.receive(report);
      this.tray.receiveWork(report);
    }
    catch (error) {
      this.log.write(Resources.formatEventNotForwarded(event.name.text, String(error)));
    }
  }

  private isLastOpen(prompt: IQuitPrompt): boolean {
    return [...this.windows.values()].every(t => t === prompt);
  }

  private async readWorkAsync(): Promise<WorkReport | null> {
    const connection = this.startup.connection;
    if (Object.isNull(connection))
      return null;
    try {
      const response = await connection.callAsync(ShellMethods.work, null, Resources.workQueryTimeout);
      return response.hasFailed ? null : WorkReport.fromJson(response.payload);
    }
    catch (error) {
      this.log.write(Resources.formatWorkNotRead(String(error)));
      return null;
    }
  }

  private async stopWorkAsync(): Promise<void> {
    const failure = (await this.callAsync(ShellMethods.stop, new StopRequest(StopPolicy.StopWork).toJson())).failure;
    if (!Object.isUndefined(failure))
      this.log.write(Resources.formatWorkNotStopped(failure.message));
  }

  private answerQuit(event: IIpcEvent, choice: unknown): boolean {
    const open = this.findTrusted(event);
    return !Object.isNull(open) && this.quit.answer(open, choice);
  }

  private writeModuleLog(event: IIpcEvent, moduleId: unknown, message: unknown): void {
    if (!Object.isNull(this.findTrusted(event)) && DesktopApplication.isModuleId(moduleId) && Object.isString(message))
      this.writeWindowText(message, t => Resources.formatModuleLogLine(moduleId, t));
  }

  private writeWindowError(event: IIpcEvent, moduleId: unknown, text: unknown): void {
    const open = this.findTrusted(event);
    if (Object.isNull(open) || !(Object.isNull(moduleId) || DesktopApplication.isModuleId(moduleId)) || !Object.isString(text))
      return;
    const admission = open.errors.admit();
    if (admission === WindowErrorAdmission.Write)
      this.writeWindowText(text, t => Resources.formatWindowErrorLine(moduleId, t));
    else if (admission === WindowErrorAdmission.Notice)
      this.log.write(Resources.windowErrorsLeftOut);
  }

  private writeWindowText(text: string, format: (line: string) => string): void {
    this.log.write(LogText.lines(text.slice(0, Resources.windowLogLimit)).map(format).join(Resources.logLineSeparator));
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

  private openNotification(id: string): void {
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
    if (name.text === ShellMethods.notifications.text)
      return await this.readNotificationsAsync(name);
    if (Resources.deviceMethods.includes(name.text))
      return await this.requestForDeviceAsync(name, value);
    return (await this.callAsync(name, value)).toJson();
  }

  private readSettingForDevice(event: Event): JsonValue | undefined {
    try {
      const change = SettingChange.fromJson(event.payload);
      this.trayIcon.receive(change, this.knownDevice);
      if (Object.isNull(change.key.device))
        return event.payload;
      return change.key.device === this.knownDevice ? new SettingChange(new SettingKey(change.key.name, change.key.scope), change.value, change.isSet).toJson() : undefined;
    }
    catch (error) {
      this.log.write(Resources.formatEventNotForwarded(event.name.text, String(error)));
      return undefined;
    }
  }

  private async requestForDeviceAsync(name: QualifiedName, value: JsonValue): Promise<JsonObject> {
    if (!Object.isObject(value) || Array.isArray(value))
      return DesktopApplication.fail(FailureCode.InvalidMessage, Resources.deviceRequestPayloadNotObject);
    const device = await this.device;
    if (Object.isNull(device))
      return DesktopApplication.fail(FailureCode.Unavailable, Resources.deviceRequestNeedsIdentity);
    return (await this.callAsync(name, { ...value, [Resources.deviceField]: device })).toJson();
  }

  private readStateForDevice(event: Event): JsonObject | undefined {
    try {
      const broadcast = NotificationBroadcast.fromJson(event.payload);
      this.notifier.receive(broadcast);
      const state = Object.isNull(this.knownDevice) ? new NotificationState(broadcast.notifications, false, broadcast.mutedModules, broadcast.sequence) : broadcast.stateFor(this.knownDevice);
      this.tray.receiveNotifications(state);
      return state.toJson();
    }
    catch (error) {
      this.log.write(Resources.formatEventNotForwarded(event.name.text, String(error)));
      return undefined;
    }
  }

  private readRecentCommandsForDevice(event: Event): JsonObject | undefined {
    try {
      const recent = RecentCommands.fromJson(event.payload);
      return recent.device === this.knownDevice ? new RecentCommands(recent.ids).toJson() : undefined;
    }
    catch (error) {
      this.log.write(Resources.formatEventNotForwarded(event.name.text, String(error)));
      return undefined;
    }
  }

  private async refreshTrayAsync(): Promise<void> {
    const epoch = this.notifier.epoch;
    const device = await this.device;
    if (Object.isNull(device))
      return;
    const [work, notifications] = await Promise.all([
      this.callAsync(ShellMethods.work, null),
      this.callAsync(ShellMethods.notifications, new NotificationsQuery(device).toJson()),
      this.trayIcon.refreshAsync(device)
    ]);
    if (epoch !== this.notifier.epoch)
      return;
    try {
      if (!work.hasFailed)
        this.tray.receiveWork(WorkReport.fromJson(work.payload));
      if (!notifications.hasFailed)
        this.tray.receiveNotifications(NotificationState.fromJson(notifications.payload));
    }
    catch (error) {
      this.log.write(Resources.formatTrayStateNotRead(String(error)));
    }
  }

  private async setDoNotDisturbAsync(isOn: boolean): Promise<void> {
    const device = await this.device;
    const failure = Object.isNull(device)
      ? new Failure(FailureCode.Unavailable, Resources.deviceNotIdentified)
      : (await this.callAsync(ShellMethods.setSetting, new SettingValue(new SettingKey(ShellSettings.doNotDisturb, null, device), isOn).toJson())).failure;
    if (Object.isUndefined(failure))
      return;
    this.log.write(Resources.formatDoNotDisturbNotSet(failure.message));
    this.tray.rebuildMenu();
  }

  private reopen(): void {
    if (Object.isNull(this.focus()))
      this.open();
  }

  private async readNotificationsAsync(name: QualifiedName): Promise<JsonObject> {
    const epoch = this.notifier.epoch;
    const device = await this.device;
    if (Object.isNull(device))
      return DesktopApplication.fail(FailureCode.Unavailable, Resources.deviceNotIdentified);
    const response = await this.callAsync(name, new NotificationsQuery(device).toJson());
    this.beginNotifier(epoch, device, response);
    return response.toJson();
  }

  private async callAsync(method: QualifiedName, payload: JsonValue): Promise<Response> {
    const connection = this.startup.connection;
    if (Object.isNull(connection))
      return Response.failure(null, new Failure(FailureCode.Disconnected, Resources.runtimeNotConnected));
    try {
      return await connection.callAsync(method, payload);
    }
    catch (error) {
      if (!(error instanceof ConnectionException))
        throw error;
      return Response.failure(null, new Failure(connection.isConnected ? FailureCode.Unavailable : FailureCode.Disconnected, error.message));
    }
  }

  private async prepareAsync(open: OpenWindow): Promise<void> {
    const kind = this.startup.current.kind;
    if (kind === StartupStateKind.Connecting)
      return;
    if (kind === StartupStateKind.Ready && this.restored.has(open))
      await open.bounds.saveUnsavedAsync().catch((error: unknown) => {
        if (!(error instanceof WindowStateUnavailableException))
          this.log.write(Resources.formatBoundsUnsaved(String(error)));
      });
    else if (kind === StartupStateKind.Ready) {
      this.restored.add(open);
      const device = await this.device;
      if (!Object.isNull(device))
        await open.bounds.restoreAsync(this.createBoundsStore(device)).catch((error: unknown) => {
          if (error instanceof WindowStateUnavailableException)
            this.restored.delete(open);
          else
            this.log.write(Resources.formatBoundsNotRestored(String(error)));
        });
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

  private async openLinkAsync(url: unknown): Promise<boolean> {
    const link = LinkPolicy.findAllowed(url);
    if (Object.isNull(link)) {
      this.log.write(Resources.linkRefused);
      return false;
    }
    try {
      await this.electron.shell.openExternal(link);
      return true;
    }
    catch (error) {
      this.log.write(Resources.formatLinkNotOpened(String(error)));
      return false;
    }
  }

  private async installCommandAsync(event: IIpcEvent): Promise<boolean> {
    const open = this.findTrusted(event);
    if (Object.isNull(open) || this.process.platform !== Resources.macPlatform)
      return false;
    const command = this.createPathCommand(this.process.execPath);
    let outcome: PathCommandOutcome;
    try {
      outcome = await command.installAsync();
    }
    catch (error) {
      if (!(error instanceof PathCommandException))
        throw error;
      this.log.write(error.message);
      await this.electron.dialog.showMessageBox(open.window.id, { type: Resources.warningBoxType, message: Resources.commandNotInstalled, detail: error.message, noLink: true });
      return false;
    }
    if (outcome === PathCommandOutcome.Cancelled)
      return false;
    await this.electron.dialog.showMessageBox(open.window.id, DesktopApplication.describeCommand(outcome, command.linkPath));
    return outcome === PathCommandOutcome.Installed || outcome === PathCommandOutcome.AlreadyInstalled;
  }

  private static describeCommand(outcome: PathCommandOutcome, link: string): MessageBoxOptions {
    switch (outcome) {
      case PathCommandOutcome.Installed:
        return { type: Resources.infoBoxType, message: Resources.commandInstalled, detail: Resources.formatCommandInstalledDetail(link), noLink: true };
      case PathCommandOutcome.AlreadyInstalled:
        return { type: Resources.infoBoxType, message: Resources.commandAlreadyInstalled, detail: Resources.formatCommandAlreadyInstalledDetail(link), noLink: true };
      case PathCommandOutcome.Occupied:
        return { type: Resources.warningBoxType, message: Resources.commandNotInstalled, detail: Resources.formatCommandOccupiedDetail(link), noLink: true };
      default:
        return { type: Resources.warningBoxType, message: Resources.commandNotInstalled, detail: Resources.commandMissingDetail, noLink: true };
    }
  }

  private createBoundsStore(device: string): RuntimeWindowStateStore {
    return new RuntimeWindowStateStore(() => this.startup.connection, new WindowStateKey(device, Resources.mainWindow), ShellMethods.readWindowBounds, ShellMethods.writeWindowBounds);
  }

  private handOver(handover: RuntimeHandover): boolean {
    if (!this.isPackaged)
      return false;
    this.process.startDetached(handover.executablePath, this.process.argv.filter(t => Resources.handoverArguments.some(u => t.startsWith(u))),
      t => this.log.write(Resources.formatHandoverFailed(String(t))));
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

  private async saveForUpdateAsync(): Promise<readonly string[]> {
    const problems = await Promise.all([...this.windows.values()].map((t, index) => t.updateSaves.requestAsync(index + 1)));
    return problems.flat();
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

  private static isModuleId(value: unknown): value is string {
    return Object.isString(value) && Resources.moduleIdPattern.test(value);
  }

  private static locateDeviceFolder(process: IDesktopProcess): string {
    return DesktopApplication.readArgument(process.argv, Resources.deviceDirectoryArgument) ?? DeviceFolder.locate(process.platform, process.env, process.homeFolder);
  }

  private static readArgument(argv: readonly string[], prefix: string): string | undefined {
    return argv.find(t => t.startsWith(prefix))?.slice(prefix.length);
  }
}
