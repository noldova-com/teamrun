/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import type { MessageBoxOptions } from "electron";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";
import {
  CommandRun, type Event, Failure, FailureCode, NotificationAction, NotificationBroadcast, NotificationPost, NotificationSeverity, NotificationState, NotificationsQuery, QualifiedName, QuitAnswered,
  RecentCommands, Response, type RuntimeHandover, SettingChange, SettingKey, SettingValue, ShellEvents, ShellMethods, ShellNotifications, StopPolicy, StopRequest, WindowStateKey, WindowStateValue,
  WindowStateWrite, WorkReport
} from "@noldova/teamrun-shell-protocol";
import {
  AppImageSource,
  ChildProcessStarter,
  ConnectionException,
  type DataDirectory,
  DataDirectoryLocator,
  DeviceFolder,
  DiagnosticRedactor,
  Installation,
  LaunchSettings,
  LogText,
  type ProcessPresence,
  RuntimeBuild,
  RuntimeEntry,
  ShellSettings
} from "@noldova/teamrun-shell-runtime";

import { PathCommandException } from "../exceptions/path-command.exception.js";
import { UnusableFolderException } from "../exceptions/unusable-folder.exception.js";
import { WindowStateUnavailableException } from "../exceptions/window-state-unavailable.exception.js";
import type { IContextMenuParams } from "../interfaces/i-context-menu-params.js";
import type { IDesktopProcess } from "../interfaces/i-desktop-process.js";
import type { IDeviceFileStore } from "../interfaces/i-device-file-store.js";
import type { IElectron } from "../interfaces/i-electron.js";
import type { IIpcEvent } from "../interfaces/i-ipc-event.js";
import type { IPreventableEvent } from "../interfaces/i-preventable-event.js";
import type { IQuitPrompt } from "../interfaces/i-quit-prompt.js";
import type { IRuntimeLauncher } from "../interfaces/i-runtime-launcher.js";
import type { ISystemNotification } from "../interfaces/i-system-notification.js";
import type { IUpdateHost } from "../interfaces/i-update-host.js";
import type { IUpdateCheckLock } from "../interfaces/i-update-check-lock.js";
import type { IUpdateHandoff } from "../interfaces/i-update-handoff.js";
import type { IUpdateSetup } from "../interfaces/i-update-setup.js";
import type { UpdateReadyRecord } from "../models/update-ready-record.js";
import { UpdateStatus } from "../models/update-status.js";
import type { IWindowContents } from "../interfaces/i-window-contents.js";
import { MainProcessFailureKind } from "../enums/main-process-failure-kind.js";
import { PathCommandOutcome } from "../enums/path-command-outcome.js";
import { StartupStateKind } from "../enums/startup-state-kind.js";
import { UpdateStateKind } from "../enums/update-state-kind.js";
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
import { AppImageEnvironment } from "./app-image-environment.js";
import { AppImageRestart } from "./app-image-restart.js";
import { ApplicationMenu } from "./application-menu.js";
import { DesktopLog } from "./desktop-log.js";
import { DeviceSettingFollower } from "./device-setting-follower.js";
import { DeviceState } from "./device-state.js";
import { MenuBarTemplate } from "./menu-bar-template.js";
import { LinkPolicy } from "./link-policy.js";
import { MainProcessRecovery } from "./main-process-recovery.js";
import { OpenWindow } from "./open-window.js";
import type { PathCommand } from "./path-command.js";
import { QuitCoordinator } from "./quit-coordinator.js";
import { QuitFlow } from "./quit-flow.js";
import { RuntimeStartup } from "./runtime-startup.js";
import { RuntimeWindowStateStore } from "./runtime-window-state-store.js";
import { SenderPolicy } from "./sender-policy.js";
import { SpellChecker } from "./spell-checker.js";
import { SpellingDictionaries } from "./spelling-dictionaries.js";
import { SystemNotifier } from "./system-notifier.js";
import { TerminalRelaunch } from "./terminal-relaunch.js";
import { TrayController } from "./tray-controller.js";
import { TrayHostWatcher } from "./tray-host-watcher.js";
import { UpdateBarrierGate } from "./update-barrier-gate.js";
import { UpdateBarrierWatch } from "./update-barrier-watch.js";
import { UpdateController } from "./update-controller.js";
import { UpdateStop } from "./update-stop.js";
import { UpdateTargetConnector } from "./update-target-connector.js";
import { UpdateWorkQuestion } from "./update-work-question.js";
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
  private readonly quitFlow: QuitFlow;
  private readonly deviceState: DeviceState;
  private readonly tray: TrayController;
  private readonly trayHosts: TrayHostWatcher;
  private readonly trayIcon: DeviceSettingFollower;
  private readonly updates: UpdateController | null;
  private readonly handoff: IUpdateHandoff | null;
  private readonly installation: Installation;
  private readonly presence: Pick<ProcessPresence, "stampAsync" | "isRunningAsync">;
  private readonly connector: UpdateTargetConnector;
  private readonly updatesOff: UpdateStatus;
  private readonly updateChecks: DeviceSettingFollower;
  private readonly spelling: SpellChecker;
  private readonly readDeviceAsync: (folder: string) => Promise<string>;
  private readonly deviceFolder: string;
  private readonly appearanceStore: IDeviceFileStore;
  private readonly createPathCommand: (executablePath: string) => PathCommand;
  private appearance: JsonObject | null = null;
  private readonly windows: Map<number, OpenWindow> = new Map();
  private readonly restored: WeakSet<OpenWindow> = new WeakSet();
  private device: Promise<string | null> = Promise.resolve(null);
  private knownDevice: string | null = null;
  private isReady: boolean = false;
  private updatesStarted: Promise<void> = Promise.resolve();
  private hasPassedBarrier: boolean = false;
  private isExiting: boolean = false;
  private runtimeQuit: Promise<void> | null = null;
  private trayCloseHint: ISystemNotification | null = null;
  private updateQuestion: UpdateWorkQuestion | null = null;

  private constructor(
    electron: IElectron,
    process: IDesktopProcess,
    settings: DesktopSettings,
    taskbar: TaskbarIdentity,
    dataDirectory: DataDirectory,
    log: DesktopLog,
    launcher: IRuntimeLauncher,
    readDeviceAsync: (folder: string) => Promise<string>,
    createDeviceFile: (folder: string, fileName: string) => IDeviceFileStore,
    createPathCommand: (executablePath: string) => PathCommand,
    icons: AppIcons,
    spelling: SpellChecker,
    installation: Installation,
    presence: Pick<ProcessPresence, "stampAsync" | "isRunningAsync">,
    connector: UpdateTargetConnector,
    recordDesktopAsync: () => Promise<boolean>,
    setup: IUpdateSetup | null,
    updateLock: IUpdateCheckLock,
    updatesOff: UpdateStatus) {
    this.electron = electron;
    this.createPathCommand = createPathCommand;
    this.readDeviceAsync = readDeviceAsync;
    this.deviceFolder = DesktopApplication.locateDeviceFolder(process);
    this.appearanceStore = createDeviceFile(this.deviceFolder, Resources.appearanceFile);
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
      passBarrierAsync: t => this.passBarrierAsync(() => this.gate.askAsync(t)),
      quit: () => {
        this.isExiting = true;
        electron.app.exit(Resources.quitExitCode);
      }
    };
    this.startup = new RuntimeStartup(launcher, t => this.publish(t), t => this.handOver(t), Resources.workWaitInterval, t => this.forward(t), t => this.log.write(t), Date.now, (t, signal) => delay(t, undefined, { signal }), updates);
    this.watch = new UpdateBarrierWatch(updates, () => !Object.isNull(this.startup.connection), Resources.updateBarrierInterval);
    this.recordDesktopAsync = recordDesktopAsync;
    this.quit = new QuitCoordinator(() => this.readWorkAsync());
    this.quitFlow = new QuitFlow({
      isExiting: () => this.isExiting,
      keepsRunningWithoutWindows: () => this.keepsRunningWithoutWindows(),
      isLast: t => this.isLastOpen(t),
      saveAllAsync: () => this.saveAllAsync(),
      stopAsync: t => this.stopAsync(t),
      findPromptAsync: () => this.findPromptAsync(),
      quit: () => electron.app.quit(),
      exit: () => this.exit()
    }, this.quit);
    this.deviceState = new DeviceState(createDeviceFile(this.deviceFolder, Resources.deviceStateFile), t => this.log.write(t));
    this.tray = new TrayController(electron.tray, electron.menu, icons, process.platform,
      { open: () => this.reopen(), openNotification: t => this.openNotification(t), setDoNotDisturb: t => void this.setDoNotDisturbAsync(t), quit: () => electron.app.quit() }, t => this.log.write(t),
      t => this.followTrayIcon(t));
    this.trayHosts = new TrayHostWatcher(process.platform, process.programs, process.env, t => delay(t, undefined, { ref: false }), t => this.changeTrayHost(t));
    this.trayIcon = new DeviceSettingFollower(ShellSettings.trayIcon, process.platform !== Resources.macPlatform, t => this.callAsync(ShellMethods.readSetting, t.toJson()),
      t => this.followTrayIconSetting(t), t => this.log.write(t));
    this.updates = Object.isNull(setup) ? null : new UpdateController(setup.updater, createDeviceFile(installation.folder, Resources.updateReadyFile), updateLock,
      RuntimeBuild.identity.productVersion, process.platform === Resources.macPlatform && !electron.app.isInApplicationsFolder(), setup.handoff.refusal, t => this.publishUpdate(t), t => this.postUpdateReadyAsync(t),
      t => log.write(t), Date.now, (wait, run) => DesktopApplication.schedule(wait, run), t => this.restartToUpdateAsync(t, setup.handoff));
    this.handoff = setup?.handoff ?? null;
    this.installation = installation;
    this.presence = presence;
    this.connector = connector;
    this.updatesOff = updatesOff;
    this.updateChecks = new DeviceSettingFollower(ShellSettings.updateChecks, Resources.automaticUpdateChecks, t => this.callAsync(ShellMethods.readSetting, t.toJson()),
      t => this.followUpdateChecksSetting(t), t => this.log.write(t));
    this.spelling = spelling;
  }

  public static start(
    electron: IElectron,
    process: IDesktopProcess,
    moduleUrl: string,
    createLauncher: (settings: LaunchSettings, installation: Installation) => IRuntimeLauncher,
    readDeviceAsync: (folder: string) => Promise<string>,
    createDeviceFile: (folder: string, fileName: string) => IDeviceFileStore,
    createPathCommand: (executablePath: string) => PathCommand,
    recordDesktopAsync: (installation: Installation) => Promise<boolean>,
    createUpdater: (installation: Installation, logsFolder: string, log: (text: string) => void) => IUpdateSetup | null,
    createUpdateLock: (installation: Installation, log: (text: string) => void) => IUpdateCheckLock): void {
    const redactor = new DiagnosticRedactor(process.homeFolder);
    const recovery = new MainProcessRecovery(electron.app, electron.dialog, process.errorOutput, redactor);
    TerminalRelaunch.forgetConsole(process);
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
      DesktopApplication.readFolderArgument(process, Resources.dataDirectoryArgument));
    const userData = DesktopApplication.readFolderArgument(process, Resources.userDataArgument);
    if (Object.isUndefined(userData))
      DesktopApplication.keepProfileIn(electron, dataDirectory);
    const launchSettings = new LaunchSettings(
      dataDirectory,
      process.execPath,
      RuntimeEntry.entryPath,
      { ...process.env, [Resources.runAsNodeVariable]: Resources.runAsNodeValue },
      process.platform);
    const presence = process.presence;
    const deviceFolder = DesktopApplication.locateDeviceFolder(process);
    const installation = new Installation(Installation.locate(deviceFolder, AppImageSource.locateProgram(process.env, process.execPath), process.platform), t => presence.isRunningAsync(t));
    const connector = new UpdateTargetConnector(installation.folder, t => Installation.locate(deviceFolder, t, process.platform),
      t => createLauncher(new LaunchSettings(t, launchSettings.executablePath, launchSettings.entryPath, launchSettings.environment, process.platform), installation), presence);
    const icons = new AppIcons(join(moduleDirectory, ...Resources.repositoryRootSegments, ...Resources.iconFolderSegments), process.platform);
    const taskbar = TaskbarIdentity.create(isPackaged, process.execPath, icons.window, fileURLToPath(moduleUrl), process.argv, process.workingDirectory);
    const log = new DesktopLog(dataDirectory, process.errorOutput, redactor);
    const profileFolder = userData ?? dataDirectory.profileFolder;
    const languages = process.platform === Resources.macPlatform
      ? []
      : SpellingDictionaries.install(join(moduleDirectory, ...Resources.repositoryRootSegments, ...Resources.dictionaryFolderSegments), profileFolder, t => log.write(t));
    const spelling = new SpellChecker(
      () => electron.session.defaultSession, languages, SpellingDictionaries.addressOf(profileFolder), process.platform, () => electron.app.getPreferredSystemLanguages(), t => log.write(t));
    const [setup, updatesOff] = DesktopApplication.createUpdater(createUpdater, installation, dataDirectory, log);
    const application = new DesktopApplication(
      electron, process, DesktopSettings.fromModule(moduleDirectory, process.platform), taskbar, dataDirectory, log, createLauncher(launchSettings, installation), readDeviceAsync, createDeviceFile, createPathCommand, icons,
      spelling, installation, presence, connector, () => recordDesktopAsync(installation), setup, createUpdateLock(installation, t => log.write(t)), updatesOff);
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
    const relaunch = TerminalRelaunch.find(this.process, this.isPackaged);
    if (Object.isNull(relaunch)) {
      this.listen();
      return;
    }
    app.releaseSingleInstanceLock();
    void relaunch.startAsync(() => app.whenReady()).then(() => app.exit(Resources.quitExitCode), (error: unknown) => this.stayInTerminal(error));
  }

  private stayInTerminal(error: unknown): void {
    this.log.write(Resources.formatRelaunchFailed(String(error)));
    if (this.electron.app.requestSingleInstanceLock())
      this.listen();
    else
      this.electron.app.quit();
  }

  private listen(): void {
    const app = this.electron.app;
    app.on(Resources.secondInstanceEvent, () => this.reopen());
    app.on(Resources.beforeQuitEvent, (event: IPreventableEvent) => this.beforeQuit(event));
    app.on(Resources.windowAllClosedEvent, () => {
      if (!this.keepsRunningWithoutWindows())
        app.quit();
    });
    app.on(Resources.willQuitEvent, () => {
      this.watch.stop();
      this.updates?.stop();
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
    this.electron.ipcMain.handle(Resources.readTrayAvailableChannel, event => Object.isNull(this.findTrusted(event)) ? null : this.trayHosts.isAvailable);
    this.electron.ipcMain.on(Resources.spellingChannel, (event, isChecking, languages) => this.keepSpelling(event, isChecking, languages));
    this.electron.ipcMain.handle(Resources.replaceMisspellingChannel, (event, text) => this.replaceMisspelling(event, text));
    this.electron.ipcMain.handle(Resources.addToDictionaryChannel, (event, word) => this.addToDictionary(event, word));
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
    this.electron.ipcMain.handle(Resources.readUpdateChannel, event => Object.isNull(this.findTrusted(event)) ? null : (this.updates?.status ?? this.updatesOff).toJson());
    this.electron.ipcMain.handle(Resources.updateActionChannel, (event, action) => !Object.isNull(this.findTrusted(event)) && this.updates?.act(action) === true);
    this.electron.ipcMain.handle(Resources.editChannel, (event, action) => this.edit(event, action));
    this.electron.app.on(Resources.activateEvent, () => {
      if (this.hasPassedBarrier && this.windows.size === 0 && !this.isQuitting)
        this.open();
    });
    void Promise.all([this.passBarrierAsync(() => this.gate.passAsync()), this.readAppearanceAsync(), this.recordSelfAsync(), this.deviceState.readAsync()]).then(([isClear, , , state]) => {
      if (!isClear) {
        this.electron.app.exit(Resources.quitExitCode);
        return;
      }
      this.hasPassedBarrier = true;
      const trayIcon = state[Resources.trayIconStateKey];
      if (Object.isBoolean(trayIcon))
        this.trayIcon.startFrom(trayIcon);
      const updateChecks = state[Resources.updateChecksStateKey];
      if (Object.isString(updateChecks))
        this.updateChecks.startFrom(updateChecks);
      this.tray.setHostAvailable(this.trayHosts.isAvailable);
      this.tray.setEnabled(this.trayIcon.value === true);
      this.trayHosts.start();
      this.open();
      this.watch.start();
      if (!Object.isNull(this.updates))
        this.updatesStarted = this.startUpdatesAsync(this.updates);
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

  private addToDictionary(event: IIpcEvent, word: unknown): boolean {
    return !Object.isNull(this.findTrusted(event)) && Object.isString(word) && Resources.dictionaryWordPattern.test(word) && this.spelling.addWord(word);
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

  private open(): OpenWindow {
    const window = this.factory.create(WindowState.createDefault(ScreenArea.of(this.electron.screen.getPrimaryDisplay().workArea)), this.appearance);
    const contentsId = window.webContents.id;
    const open = new OpenWindow(window, this.electron.screen, this.log, this.quitFlow, this.settings.platform);
    window.webContents.on(Resources.didStartLoadingEvent, () => this.notifier.hold());
    window.webContents.on(Resources.contextMenuEvent, (_event, params) => this.forwardFieldMenu(open, params));
    new WindowRecovery(open, this.electron.dialog, this.log, this.process, () => this.electron.app.quit(), () => this.openLogFolderAsync(), Resources.reloadCrashLimit, Resources.rendererEndLimit);
    this.windows.set(contentsId, open);
    window.once(Resources.closedEvent, () => {
      this.windows.delete(contentsId);
      this.closeToBackground();
    });
    open.settleWithin(Resources.connectingShowLimit);
    open.showUnpaintedWithin(Resources.paintShowLimit);
    void this.prepareAsync(open);
    return open;
  }

  private publish(state: StartupState): void {
    if (!DesktopApplication.UNOWNED_STATES.includes(state.kind))
      this.log.open();
    const isReady = state.kind === StartupStateKind.Ready;
    if (isReady !== this.isReady)
      this.notifier.reset();
    if (!isReady)
      this.quit.release();
    if (isReady && !this.isReady) {
      void this.refreshTrayAsync();
      void this.refreshUpdatesAsync();
    }
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
    if (event.name.text === ShellEvents.quitting.text) {
      this.runtimeQuit ??= this.quitForRuntimeAsync().finally(() => {
        this.runtimeQuit = null;
      });
      return;
    }
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

  private async quitForRuntimeAsync(): Promise<void> {
    if (this.isExiting)
      return;
    const answer = await this.quitFlow.quitAsync();
    if (!Object.isNull(answer))
      await this.callAsync(ShellMethods.quitAnswered, new QuitAnswered(answer).toJson());
  }

  private changeTrayHost(isAvailable: boolean): void {
    this.tray.setHostAvailable(isAvailable);
    for (const open of this.windows.values())
      if (!open.window.isDestroyed())
        open.window.webContents.send(Resources.trayAvailableChannel, isAvailable);
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

  private beforeQuit(event: IPreventableEvent): void {
    if (this.isExiting)
      return;
    event.preventDefault();
    void this.quitFlow.quitAsync();
  }

  private get isQuitting(): boolean {
    return this.isExiting || this.quitFlow.isQuitting;
  }

  private keepsRunningWithoutWindows(): boolean {
    return this.settings.platform === Resources.macPlatform || this.tray.isShown;
  }

  private closeToBackground(): void {
    if (this.windows.size === 0 && !this.isQuitting && this.settings.platform !== Resources.macPlatform && this.tray.isShown)
      void this.deviceState.showOnceAsync(Resources.trayCloseHintKey, () => this.showTrayCloseHintAsync());
  }

  private showTrayCloseHintAsync(): Promise<boolean> {
    const notifications = this.electron.notifications;
    if (!notifications.isSupported())
      return Promise.resolve(false);
    const shown = Promise.withResolvers<boolean>();
    const hint = notifications.create({ title: Resources.trayCloseHintTitle, body: Resources.formatTrayCloseHintBody(this.settings.platform), icon: this.icons.window, silent: true });
    const release = (): void => {
      if (this.trayCloseHint === hint)
        this.trayCloseHint = null;
    };
    hint.on(Resources.showEvent, () => shown.resolve(true));
    hint.on(Resources.clickEvent, () => {
      release();
      this.reopen();
    });
    hint.on(Resources.closeEvent, release);
    hint.on(Resources.failedEvent, (_event, error) => {
      release();
      this.log.write(Resources.formatTrayCloseHintFailed(error));
      shown.resolve(false);
    });
    this.trayCloseHint = hint;
    hint.show();
    return shown.promise;
  }

  private followTrayIconSetting(value: JsonValue): void {
    this.tray.setEnabled(value === true);
    void this.deviceState.rememberAsync(Resources.trayIconStateKey, value);
  }

  private followUpdateChecksSetting(value: JsonValue): void {
    this.updates?.follow(value);
    void this.deviceState.rememberAsync(Resources.updateChecksStateKey, value);
  }

  private followTrayIcon(isShown: boolean): void {
    if (!isShown && this.windows.size === 0 && !this.isQuitting && !this.keepsRunningWithoutWindows())
      this.open();
  }

  private async saveAllAsync(): Promise<boolean> {
    const saved = await Promise.all([...this.windows.values()].map(t => t.saveAsync()));
    return saved.every(t => t);
  }

  private async stopAsync(policy: StopPolicy): Promise<boolean> {
    const failure = (await this.callAsync(ShellMethods.stop, new StopRequest(policy, true).toJson())).failure;
    if (Object.isUndefined(failure) || failure.code === FailureCode.Disconnected)
      return false;
    if (failure.code === FailureCode.Conflict && policy === StopPolicy.IfIdle)
      return true;
    this.log.write(Resources.formatRuntimeNotStopped(failure.message));
    return false;
  }

  private async findPromptAsync(): Promise<IQuitPrompt | null> {
    const open = this.focus() ?? this.open();
    return await open.whenPaintedAsync() ? open : null;
  }

  private exit(): void {
    this.isExiting = true;
    this.startup.close();
    for (const open of this.windows.values())
      open.closeNow();
    this.electron.app.quit();
  }

  private answerQuit(event: IIpcEvent, choice: unknown): boolean {
    const open = this.findTrusted(event);
    return !Object.isNull(open) && (this.updateQuestion?.answer(open, choice) === true || this.quit.answer(open, choice));
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
      this.updateChecks.receive(change, this.knownDevice);
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

  private async startUpdatesAsync(updates: UpdateController): Promise<void> {
    await this.handoff?.clearAsync();
    updates.follow(this.updateChecks.value);
    await updates.startAsync();
  }

  private async restartToUpdateAsync(record: UpdateReadyRecord, handoff: IUpdateHandoff): Promise<void> {
    const restart = AppImageRestart.find(this.process.platform, this.process.env, this.process.execPath, this.launchArguments, new ChildProcessStarter(), this.process.processId,
      join(this.dataDirectory.logsFolder, Resources.restartErrorFile));
    const stop = new UpdateStop(this.installation, this.presence, t => this.connector.connectAsync(t), (work, read) => this.askUpdateWorkAsync(work, read), this.process.processId,
      RuntimeBuild.identity.productVersion, Date.now, delay, restart);
    if (await stop.runAsync(record.version, () => handoff.handOffAsync(record)))
      await this.quitAfterHandoffAsync();
  }

  private async askUpdateWorkAsync(work: readonly string[], readWorkAsync: () => Promise<readonly string[]>): Promise<readonly string[] | null> {
    const prompt = await this.findPromptAsync();
    if (Object.isNull(prompt))
      return null;
    const question = new UpdateWorkQuestion(prompt, readWorkAsync, Resources.workWaitInterval, (t, signal) => delay(t, undefined, { signal }));
    this.updateQuestion = question;
    try {
      return await question.askAsync(work);
    }
    finally {
      this.updateQuestion = null;
    }
  }

  private async quitAfterHandoffAsync(): Promise<void> {
    this.isExiting = true;
    if (this.process.platform === Resources.macPlatform)
      try {
        this.electron.nativeUpdater.quitAndInstall();
        return;
      }
      catch (error) {
        this.log.write(Resources.formatUpdateRelaunchFailed(String(error)));
        await this.electron.dialog.showMessageBox(null, {
          type: Resources.warningBoxType, message: Resources.updateRelaunchFailed, detail: Resources.updateRelaunchFailedDetail, buttons: [Resources.okButton], defaultId: 0, cancelId: 0,
          noLink: true
        }).catch(() => undefined);
      }
    this.electron.app.exit(Resources.quitExitCode);
  }

  private get launchArguments(): readonly string[] {
    return this.process.argv.filter(t => Resources.handoverArguments.some(u => t.startsWith(u)));
  }

  private async refreshUpdatesAsync(): Promise<void> {
    const updates = this.updates;
    if (Object.isNull(updates))
      return;
    const device = await this.device;
    if (!Object.isNull(device))
      await this.updateChecks.refreshAsync(device);
    await this.updatesStarted;
    await updates.notifyAsync();
  }

  private publishUpdate(status: UpdateStatus): void {
    const state = status.toJson();
    for (const open of this.windows.values())
      if (!open.window.isDestroyed())
        open.window.webContents.send(Resources.updateStateChannel, state);
  }

  private async postUpdateReadyAsync(version: string): Promise<boolean> {
    const restart = new CommandRun(new QualifiedName(ShellNotifications.updateReady.owner, Resources.restartToUpdateMember), null);
    const post = new NotificationPost(ShellNotifications.updateReady, version, Resources.formatUpdateReadyTitle(version), null, NotificationSeverity.Info, null,
      [new NotificationAction(Resources.restartToUpdateTitle, restart)], null);
    const failure = (await this.callAsync(ShellMethods.postNotification, post.toJson())).failure;
    if (!Object.isUndefined(failure))
      this.log.write(Resources.formatUpdateNotPosted(failure.message));
    return Object.isUndefined(failure);
  }

  private static schedule(wait: number, run: () => void): () => void {
    const timer = setTimeout(run, wait);
    timer.unref();
    return () => clearTimeout(timer);
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
    if (this.hasPassedBarrier && !this.isExiting && Object.isNull(this.focus()) && !this.quitFlow.isQuitting)
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
    this.process.startDetached(handover.executablePath, this.launchArguments, t => this.log.write(Resources.formatHandoverFailed(String(t))));
    this.exit();
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

  private static createUpdater(
    create: (installation: Installation, logsFolder: string, log: (text: string) => void) => IUpdateSetup | null,
    installation: Installation,
    dataDirectory: DataDirectory,
    log: DesktopLog): [IUpdateSetup | null, UpdateStatus] {
    try {
      return [create(installation, dataDirectory.logsFolder, t => log.write(t)), UpdateStatus.off];
    }
    catch (error) {
      log.write(Resources.formatUpdaterNotCreated(String(error)));
      return [null, new UpdateStatus(UpdateStateKind.Failed, null, null, null, Resources.updaterNotCreated, false)];
    }
  }

  private static isPackagedBuild(electron: IElectron, process: IDesktopProcess): boolean {
    return electron.app.isPackaged && !process.isDefaultApp;
  }

  private static isModuleId(value: unknown): value is string {
    return Object.isString(value) && Resources.moduleIdPattern.test(value);
  }

  private static keepProfileIn(electron: IElectron, dataDirectory: DataDirectory): void {
    try {
      electron.app.setPath(Resources.userDataPath, dataDirectory.profileFolder);
    }
    catch (error) {
      throw new UnusableFolderException(Resources.formatDataFolderUnusable(dataDirectory.root, String(error)), new ExceptionOptions(error));
    }
  }

  private static locateDeviceFolder(process: IDesktopProcess): string {
    return DesktopApplication.readFolderArgument(process, Resources.deviceDirectoryArgument) ?? DeviceFolder.locate(process.platform, process.env, process.homeFolder);
  }

  private static readFolderArgument(process: IDesktopProcess, prefix: string): string | undefined {
    const folder = process.argv.find(t => t.startsWith(prefix))?.slice(prefix.length);
    return Object.isUndefined(folder) || String.isNullOrWhitespace(folder) || isAbsolute(folder) ? folder : resolve(AppImageEnvironment.locateStartFolder(process), folder);
  }
}
