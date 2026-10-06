/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ShellMethods } from "@noldova/teamrun-shell-protocol";
import { ProductInfo } from "@noldova/teamrun-shell-runtime";

import { MainProcessFailureKind } from "./enums/main-process-failure-kind.js";

export class Resources {
  public static readonly folderSeparator: string = "/";
  public static get updateUnderWay(): string {
    return `Another update of ${Resources.applicationName} is under way.`;
  }

  public static get updateHolderNotFound(): string {
    return `${Resources.applicationName} could not find its own process in the process table.`;
  }

  public static get applicationName(): string {
    return ProductInfo.current.name;
  }

  public static get appUserModelId(): string {
    return ProductInfo.current.applicationId;
  }

  public static get developmentAppUserModelId(): string {
    return ProductInfo.current.developmentApplicationId;
  }

  public static get updateInstalling(): string {
    return `${Resources.applicationName} is installing an update.`;
  }

  public static get updateInstallingDetail(): string {
    return `Open ${Resources.applicationName} again once the update has finished.`;
  }

  public static get updateUnfinished(): string {
    return `An update of ${Resources.applicationName} may still be installing, or it did not finish.`;
  }

  public static get updateUnfinishedDetail(): string {
    return `If no installer is still running, open ${Resources.applicationName} to go on with the version you have.`;
  }

  public static get openApplicationButton(): string {
    return `Open ${Resources.applicationName}`;
  }

  public static readonly okButton: string = "OK";
  public static readonly updateStoppedBeforeHandoff: string = "An update stopped before its handoff, so its launch barrier was removed.";
  public static readonly updateBarrierCleared: string = "The person chose to open the application after an unfinished update, so its launch barrier was removed.";
  public static get updateBarrierNotCleared(): string {
    return `${Resources.applicationName} could not clear the unfinished update, so it will quit.`;
  }

  public static get updateBarrierNotClearedDetail(): string {
    return `Open ${Resources.applicationName} again in a moment. If this keeps happening, its log has the reason.`;
  }

  public static formatBarrierNotCleared(message: string): string {
    return `The launch barrier of an unfinished update could not be removed: ${message}`;
  }

  public static formatHandoverFailed(reason: string): string {
    return `The newer ${Resources.applicationName} could not be started for the hand-over, so this one quits without it: ${reason}`;
  }

  public static formatBarrierUnreadable(message: string): string {
    return `The launch barrier could not be read: ${message}`;
  }

  public static formatBarrierUnsettled(message: string): string {
    return `The launch barrier could not be settled: ${message}`;
  }

  public static formatWindowSaveUnanswered(window: number): string {
    return `Window ${window} did not finish saving within 5 seconds.`;
  }

  public static formatWindowSaveGone(window: number): string {
    return `Window ${window} closed before it saved.`;
  }

  public static formatDesktopUnrecorded(message: string): string {
    return `This desktop could not be recorded in its installation, so an update may not wait for it: ${message}`;
  }

  public static readonly checkoutHashAlgorithm: string = "sha256";
  public static readonly hexEncoding: "hex" = "hex";
  public static readonly checkoutHashLength: number = 8;
  public static readonly idSeparator: string = ".";
  public static readonly relaunchArgumentPrefixes: readonly string[] = ["--data-dir=", "--user-data-dir=", "--device-dir="];
  public static readonly appIdParameter: string = "appId";
  public static readonly iconPathParameter: string = "iconPath";
  public static readonly relaunchCommandParameter: string = "relaunchCommand";
  public static readonly readyChannel: string = "teamrun:ready";
  public static readonly menuBarChannel: string = "teamrun:menuBar";
  public static readonly menuCommandChannel: string = "teamrun:menuCommand";
  public static readonly editChannel: string = "teamrun:edit";
  public static readonly appearanceChannel: string = "teamrun:appearance";
  public static readonly closeRequestChannel: string = "teamrun:closeRequest";
  public static readonly closeAnswerChannel: string = "teamrun:closeAnswer";
  public static readonly updateSaveRequestChannel: string = "teamrun:updateSaveRequest";
  public static readonly updateSaveAnswerChannel: string = "teamrun:updateSaveAnswer";
  public static readonly startupStateChannel: string = "teamrun:startupState";
  public static readonly readStartupChannel: string = "teamrun:readStartup";
  public static readonly startupActionChannel: string = "teamrun:startupAction";
  public static readonly readLayoutChannel: string = "teamrun:readLayout";
  public static readonly writeLayoutChannel: string = "teamrun:writeLayout";
  public static readonly requestChannel: string = "teamrun:request";
  public static readonly runtimeEventChannel: string = "teamrun:runtimeEvent";
  public static readonly readBuildChannel: string = "teamrun:readBuild";
  public static readonly copyTextChannel: string = "teamrun:copyText";
  public static readonly openLogFolderChannel: string = "teamrun:openLogFolder";
  public static readonly openLinkChannel: string = "teamrun:openLink";
  public static readonly installCommandChannel: string = "teamrun:installCommand";
  public static readonly notificationOpenedChannel: string = "teamrun:notificationOpened";
  public static readonly quitQuestionChannel: string = "teamrun:quitQuestion";
  public static readonly readTrayAvailableChannel: string = "teamrun:readTrayAvailable";
  public static readonly trayAvailableChannel: string = "teamrun:trayAvailable";
  public static readonly quitAnswerChannel: string = "teamrun:quitAnswer";
  public static readonly moduleLogChannel: string = "teamrun:moduleLog";
  public static readonly windowErrorChannel: string = "teamrun:windowError";
  public static readonly copyTextLimit: number = 65536;
  public static readonly linkLimit: number = 32768;
  public static readonly linkProtocols: readonly string[] = ["http:", "https:", "mailto:"];
  public static readonly linkRefused: string = "A link was not opened: only well-formed http, https and mailto links without credentials open.";
  public static readonly shellOwner: string = "shell";
  public static readonly methodParameter: string = "method";
  public static readonly windowShellMethods: readonly string[] = [
    ShellMethods.modules.text,
    ShellMethods.commands.text,
    ShellMethods.runCommand.text,
    ShellMethods.notifications.text,
    ShellMethods.postNotification.text,
    ShellMethods.updateNotification.text,
    ShellMethods.dismissNotification.text,
    ShellMethods.markNotificationsRead.text,
    ShellMethods.clearNotifications.text,
    ShellMethods.settings.text,
    ShellMethods.readSetting.text,
    ShellMethods.setSetting.text,
    ShellMethods.resetSetting.text,
    ShellMethods.recentCommands.text,
    ShellMethods.recordCommand.text,
    ShellMethods.programs.text
  ];
  public static readonly deviceMethods: readonly string[] = [
    ShellMethods.settings.text,
    ShellMethods.readSetting.text,
    ShellMethods.setSetting.text,
    ShellMethods.resetSetting.text,
    ShellMethods.recentCommands.text,
    ShellMethods.recordCommand.text
  ];
  public static readonly deviceField: string = "device";
  public static readonly deviceRequestNeedsIdentity: string = "This device has no identity, so a request that belongs to it cannot be made.";
  public static readonly deviceRequestPayloadNotObject: string = "A request that belongs to this device must have a JSON object as its payload.";
  public static get untrustedRequest(): string {
    return `Only ${Resources.applicationName}'s own window may call the runtime.`;
  }

  public static readonly methodNotText: string = "The method must be a qualified name such as notes.open.";
  public static readonly payloadNotJson: string = "The payload must be a JSON value.";
  public static readonly layoutNotObject: string = "The layout must be a JSON object.";
  public static readonly clientName: string = "desktop";
  public static readonly handoffRole: string = "handoff";
  public static readonly moveAsideAction: string = "moveAside";
  public static readonly stopWorkAction: string = "stopWork";
  public static readonly waitAction: string = "wait";
  public static readonly retryAction: string = "retry";
  public static readonly kindField: string = "kind";
  public static readonly detailsField: string = "details";
  public static readonly dataDirectoryArgument: string = "--data-dir=";
  public static readonly userDataArgument: string = "--user-data-dir=";
  public static readonly userDataPath: "userData" = "userData";
  public static readonly runAsNodeVariable: string = "ELECTRON_RUN_AS_NODE";
  public static readonly runAsNodeValue: string = "1";
  public static readonly workWaitInterval: number = 2000;
  public static readonly stableConnectionPeriod: number = 30000;
  public static readonly reconnectionDelays: readonly number[] = [0, 1000, 2000, 4000, 8000];
  public static readonly endedByRuntime: string = "the runtime ended it.";
  public static readonly deviceDirectoryArgument: string = "--device-dir=";
  public static readonly handoverArguments: readonly string[] = [Resources.dataDirectoryArgument, Resources.userDataArgument, Resources.deviceDirectoryArgument];
  public static readonly windowsPlatform: string = "win32";
  public static readonly deviceFileName: string = "device.json";
  public static readonly deviceIdField: string = "id";
  public static readonly createOnlyFlag: string = "wx";
  public static readonly textEncoding: BufferEncoding = "utf8";
  public static readonly appearanceFile: string = "appearance.json";
  public static readonly deviceStateFile: string = "device-state.json";
  public static readonly trayCloseHintKey: string = "trayCloseHintShown";
  public static readonly trayIconStateKey: string = "trayIcon";
  public static readonly fileNameParameter: string = "fileName";
  public static readonly temporarySuffix: string = ".tmp";
  public static readonly appearanceArgument: string = "--teamrun-appearance=";
  public static readonly appearanceLimit: number = 4096;
  public static readonly appearanceTooLarge: string = "The appearance preferences are larger than 4096 characters.";
  public static readonly keepAppearanceChannel: string = "teamrun:keepAppearance";
  public static readonly readSpellingChannel: string = "teamrun:readSpelling";
  public static readonly spellingChannel: string = "teamrun:spelling";
  public static readonly fieldMenuChannel: string = "teamrun:fieldMenu";
  public static readonly replaceMisspellingChannel: string = "teamrun:replaceMisspelling";
  public static readonly addToDictionaryChannel: string = "teamrun:addToDictionary";
  public static readonly dictionaryFolderSegments: readonly string[] = ["assets", "dictionaries"];
  public static readonly dictionariesFile: string = "dictionaries.json";
  public static readonly dictionariesFolder: string = "Dictionaries";
  public static readonly dictionariesField: string = "dictionaries";
  public static readonly languageField: string = "language";
  public static readonly fileField: string = "file";
  public static readonly languagesField: string = "languages";
  public static readonly fallbackField: string = "fallback";
  public static readonly isKeyboardField: string = "isKeyboard";
  public static readonly wordField: string = "word";
  public static readonly suggestionsField: string = "suggestions";
  public static readonly keyboardMenuSource: string = "keyboard";
  public static readonly spellingTextLimit: number = 100;
  public static readonly languageTagPattern: RegExp = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/;
  public static readonly dictionaryFilePattern: RegExp = /^[A-Za-z0-9-]+\.bdic$/;
  public static readonly dictionaryWordPattern: RegExp = /^\S{1,100}$/u;
  public static readonly urlSeparator: string = "/";
  public static readonly listSeparator: string = ", ";
  public static readonly spellingInvalid: string = "The spelling preferences must be whether to check and a list of language tags.";
  public static readonly uuidPattern: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  public static readonly hashPrefix: string = "#";
  public static readonly queryPrefix: string = "?";
  public static readonly macPlatform: string = "darwin";
  public static readonly linuxPlatform: string = "linux";
  public static readonly desktopFileSuffix: string = ".desktop";
  public static get iconFolderSegments(): readonly string[] {
    return ProductInfo.current.icons.split(Resources.folderSeparator);
  }

  public static readonly windowsIcon: string = "icon-dark.ico";
  public static readonly windowIcon: string = "icon-dark-512.png";
  public static readonly dockIcon: string = "icon-dock-512.png";
  public static readonly trayFolder: string = "tray";
  public static readonly trayIconPrefix: string = "tray-";
  public static readonly trayWindowsExtension: string = ".ico";
  public static readonly trayMacSuffix: string = "Template.png";
  public static readonly trayLinuxExtension: string = ".png";
  public static readonly trayWorkRows: number = 5;
  public static readonly trayNotificationRows: number = 3;
  public static readonly trayLabelLimit: number = 60;
  public static readonly trayEllipsis: string = "…";
  public static readonly noWorkLabel: string = "No work running";
  public static readonly doNotDisturbLabel: string = "Do not disturb";
  public static readonly preloadFileName: string = "preload.cjs";
  public static readonly repositoryRootSegments: readonly string[] = ["..", "..", ".."];
  public static readonly windowIndexSegments: readonly string[] = ["_build", "window", "browser", "index.html"];
  public static readonly platformParameter: string = "platform";
  public static readonly windowIndexParameter: string = "windowIndexPath";
  public static readonly preloadParameter: string = "preloadPath";
  public static readonly hiddenTitleBarStyle: "hidden" = "hidden";
  public static readonly denyWindowOpen: "deny" = "deny";
  public static readonly trafficLightPosition: Readonly<{ x: number; y: number }> = { x: 12, y: 9 };
  public static readonly willNavigateEvent: "will-navigate" = "will-navigate";
  public static readonly willRedirectEvent: "will-redirect" = "will-redirect";
  public static readonly willAttachWebviewEvent: "will-attach-webview" = "will-attach-webview";
  public static readonly closeEvent: "close" = "close";
  public static readonly closedEvent: "closed" = "closed";
  public static readonly clickEvent: "click" = "click";
  public static readonly showEvent: "show" = "show";
  public static readonly failedEvent: "failed" = "failed";
  public static readonly dataEvent: "data" = "data";
  public static readonly errorEvent: "error" = "error";
  public static readonly secondInstanceEvent: "second-instance" = "second-instance";
  public static readonly windowAllClosedEvent: "window-all-closed" = "window-all-closed";
  public static readonly activateEvent: "activate" = "activate";
  public static readonly willQuitEvent: "will-quit" = "will-quit";
  public static readonly beforeQuitEvent: "before-quit" = "before-quit";
  public static readonly resizeEvent: "resize" = "resize";
  public static readonly moveEvent: "move" = "move";
  public static readonly willMoveEvent: "will-move" = "will-move";
  public static readonly willResizeEvent: "will-resize" = "will-resize";
  public static readonly maximizeEvent: "maximize" = "maximize";
  public static readonly unmaximizeEvent: "unmaximize" = "unmaximize";
  public static readonly boundsSaveDelay: number = 500;
  public static readonly connectingShowLimit: number = 2_000;
  public static readonly paintShowLimit: number = 10_000;
  public static readonly logLineSeparator: string = "\n";
  public static readonly moduleIdPattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  public static readonly reloadCrashLimit: number = 10_000;
  public static readonly rendererEndLimit: number = 5_000;
  public static readonly renderProcessGoneEvent: "render-process-gone" = "render-process-gone";
  public static readonly didStartLoadingEvent: "did-start-loading" = "did-start-loading";
  public static readonly contextMenuEvent: "context-menu" = "context-menu";
  public static readonly unresponsiveEvent: "unresponsive" = "unresponsive";
  public static readonly responsiveEvent: "responsive" = "responsive";
  public static readonly cleanExitReason: string = "clean-exit";
  public static readonly warningBoxType: "warning" = "warning";
  public static readonly infoBoxType: "info" = "info";
  public static readonly errorBoxType: "error" = "error";
  public static get commandName(): string {
    return ProductInfo.current.slug;
  }

  public static readonly bundleCommandSegments: readonly string[] = ["..", "Resources", "bin"];
  public static readonly pathCommandFolder: string = "/usr/local/bin";
  public static readonly scriptRunner: string = "/usr/bin/osascript";
  public static readonly administratorScript: readonly string[] = [
    "-e", "on run argv",
    "-e", "set commandLink to quoted form of (item 3 of argv)",
    "-e", "do shell script \"[ -e \" & commandLink & \" ] && [ ! -L \" & commandLink & \" ] && exit 3; /bin/mkdir -p \" & quoted form of (item 2 of argv) & \" && /bin/ln -sfh \" & quoted form of (item 1 of argv) & \" \" & commandLink with prompt (item 4 of argv) with administrator privileges",
    "-e", "end run"
  ];
  public static readonly userCancelledCode: string = "(-128)";
  public static readonly occupiedExitCode: string = "(3)";
  public static readonly missingErrorCode: string = "ENOENT";
  public static readonly errorCodeField: "code" = "code";
  public static readonly deniedErrorCodes: readonly string[] = ["EACCES", "EPERM"];
  public static get commandInstalled(): string {
    return `The ${Resources.commandName} command is installed.`;
  }

  public static get commandAlreadyInstalled(): string {
    return `The ${Resources.commandName} command is already installed.`;
  }

  public static get commandNotInstalled(): string {
    return `The ${Resources.commandName} command was not installed.`;
  }

  public static get commandMissingDetail(): string {
    return `This build of ${Resources.applicationName} has no command to link; an installed ${Resources.applicationName} has one.`;
  }
  public static get windowStopped(): string {
    return `${Resources.applicationName}'s window stopped unexpectedly.`;
  }

  public static readonly windowStoppedDetail: string = "Reload it to continue. Your layout comes back from the last save.";
  public static readonly windowStoppedAgainDetail: string = "It stopped again right after it was reloaded. The log folder has what it recorded.";
  public static get windowNotResponding(): string {
    return `${Resources.applicationName}'s window isn't responding.`;
  }

  public static readonly windowNotRespondingDetail: string = "You can wait for it or reload it.";
  public static readonly reloadButton: string = "Reload";
  public static readonly quitButton: string = "Quit";
  public static readonly waitButton: string = "Wait";
  public static readonly openLogFolderButton: string = "Open log folder";
  public static readonly windowUnresponsive: string = "The window's page stopped responding.";
  public static readonly windowResponsiveAgain: string = "The window's page responds again.";
  public static readonly windowStoppedAgainRecord: string = "The window's page stopped again within 10 s of a reload, so the person was offered the log folder instead of another reload.";
  public static readonly uncaughtExceptionEvent: "uncaughtException" = "uncaughtException";
  public static readonly unhandledRejectionEvent: "unhandledRejection" = "unhandledRejection";
  public static readonly quitExitCode: number = 0;
  public static readonly failureExitCode: number = 1;

  public static get mainProcessFailed(): string {
    return `${Resources.applicationName} stopped because of an unexpected error.`;
  }

  public static get mainProcessFailedDetail(): string {
    return "Work running in the runtime continues. Changes from the last few seconds may not have been saved. "
      + `Restart ${Resources.applicationName} to go on, or open the log folder to see what happened.`;
  }

  public static get mainProcessFailedBeforeStartDetail(): string {
    return `This happened while ${Resources.applicationName} was starting. Restart ${Resources.applicationName} to try again.`;
  }

  public static get restartButton(): string {
    return `Restart ${Resources.applicationName}`;
  }

  public static readonly mainWindow: string = "main";
  public static get runtimeNotConnected(): string {
    return `${Resources.applicationName} is not connected to its runtime.`;
  }

  public static readonly deviceNotIdentified: string = "This device has no identity, so the window's layout and Do not disturb are not kept.";
  public static readonly descriptionsField: string = "descriptions";
  public static readonly isWaitingField: string = "isWaiting";
  public static readonly isUpdateField: string = "isUpdate";
  public static readonly windowMinimumWidth: number = 640;
  public static readonly windowMinimumHeight: number = 480;
  public static readonly windowWidth: number = 1280;
  public static readonly windowHeight: number = 800;
  public static readonly windowAreaShare: number = 0.9;
  public static readonly closeAnswerTimeout: number = 5000;
  public static readonly updateBarrierInterval: number = 1000;
  public static readonly updatePrepareTimeout: number = 15000;
  public static readonly updateExitWait: number = 10000;
  public static readonly updateExitInterval: number = 250;
  public static readonly workSeparator: string = "; ";
  public static readonly workQueryTimeout: number = 2000;
  public static readonly programTimeout: number = 5000;
  public static readonly programOutputLimit: number = 65536;
  public static readonly gdbusPath: string = "/usr/bin/gdbus";
  public static readonly trayHostQueryArguments: readonly string[] = [
    "call", "--session", "--dest", "org.kde.StatusNotifierWatcher", "--object-path", "/StatusNotifierWatcher",
    "--method", "org.freedesktop.DBus.Properties.Get", "org.kde.StatusNotifierWatcher", "IsStatusNotifierHostRegistered"
  ];
  public static readonly trayHostMonitorArguments: readonly string[] = ["monitor", "--session", "--dest", "org.kde.StatusNotifierWatcher"];
  public static readonly trayHostRegisteredAnswer: string = "(<true>,)";
  public static readonly trayMonitorFirstDelay: number = 1000;
  public static readonly trayMonitorLongestDelay: number = 60_000;
  public static readonly trayMonitorDelayGrowth: number = 2;
  public static readonly windowLogLimit: number = 65536;
  public static readonly windowErrorBurst: number = 10;
  public static readonly windowErrorPeriod: number = 60000;
  public static readonly windowErrorsLeftOut: string = "The window reported more than ten errors within a minute; the rest of that minute's errors are left out of the log.";
  public static readonly executableField: string = "executable";
  public static readonly argumentsField: string = "arguments";
  public static readonly errorFileField: string = "errorFile";
  public static readonly environmentField: string = "environment";
  public static readonly environmentNotText: string = "An environment variable's value must be text.";
  public static readonly processIdField: string = "processId";
  public static readonly failureField: string = "failure";
  public static readonly payloadField: string = "payload";
  public static readonly replyNeedsOneOutcome: string = "A start reply carries either a process id or a failure.";
  public static readonly starterEnded: string = "The runtime starter ended before it started the runtime.";
  public static readonly starterAcknowledgement: string = "acknowledged";
  public static get starterServiceName(): string {
    return `${Resources.applicationName} runtime starter`;
  }

  public static readonly utilityEntryRelativePath: string = "../utility-entry.js";
  public static readonly ignoredStdio: "ignore" = "ignore";
  public static readonly messageEvent: "message" = "message";
  public static readonly exitEvent: "exit" = "exit";
  public static readonly xField: string = "x";
  public static readonly yField: string = "y";
  public static readonly widthField: string = "width";
  public static readonly heightField: string = "height";
  public static readonly maximizedField: string = "maximized";
  public static readonly invalidWindowState: string = "The saved window state is not valid.";
  public static readonly positionPairMessage: string = "A window position has both coordinates or neither.";
  public static readonly windowUrlParameter: string = "windowUrl";
  public static readonly intervalParameter: string = "interval";
  public static readonly timeoutParameter: string = "timeout";
  public static readonly backgroundField: string = "background";
  public static readonly titleBarField: string = "titleBar";
  public static readonly titleBarTextField: string = "titleBarText";
  public static readonly titleBarHeightField: string = "titleBarHeight";
  public static readonly invalidAppearance: string = "The window appearance is not valid.";
  public static readonly menusField: string = "menus";
  public static readonly placeField: string = "place";
  public static readonly titleField: string = "title";
  public static readonly rowsField: string = "rows";
  public static readonly typeField: string = "type";
  public static readonly idField: string = "id";
  public static readonly labelField: string = "label";
  public static readonly keyField: string = "key";
  public static readonly enabledField: string = "enabled";
  public static readonly checkField: string = "check";
  public static readonly checkedField: string = "checked";
  public static readonly appMenu: string = "shell.app";
  public static readonly editMenu: string = "shell.edit";
  public static readonly windowMenu: string = "shell.window";
  public static readonly helpMenu: string = "shell.help";
  public static readonly commandKey: string = "Command";
  public static readonly controlKey: string = "Control";
  public static readonly altKey: string = "Alt";
  public static readonly shiftKey: string = "Shift";
  public static readonly acceleratorSeparator: string = "+";
  public static readonly invalidMenuBar: string = "The menu bar is not valid.";
  public static readonly speechLabel: string = "Speech";
  public static readonly editTitle: string = "Edit";
  public static readonly windowTitle: string = "Window";
  public static readonly closeWindowLabel: string = "Close Window";
  public static readonly closeWindowAccelerator: string = "Command+Shift+W";
  public static readonly invalidColor: string = "A window color is a hexadecimal color or an rgb() or rgba() color.";
  public static readonly colorPattern: RegExp = /^(?:#[0-9A-Fa-f]{3,8}|rgba?\([0-9., %/]+\))$/;

  public static formatInvalidDevice(file: string): string {
    return `The device identity in ${file} is not valid; remove the file to give this device a new identity.`;
  }

  public static formatWindowStateFailed(method: string, message: string): string {
    return `The runtime refused ${method}: ${message}`;
  }

  public static formatConnectionEnded(code: string, message: string): string {
    return `The desktop ended its connection to the runtime, so it connects again (${code}): ${message}`;
  }

  public static formatEndedByDesktop(code: string, message: string): string {
    return `the desktop ended it (${code}): ${message}`;
  }

  public static formatReconnectionStopped(cause: string): string {
    return `The connection to the runtime ended ${Resources.reconnectionDelays.length + 1} times in a row, each within ${Resources.stableConnectionPeriod / 1000} seconds of connecting, so the desktop stopped connecting again. The last time, ${cause}`;
  }

  public static formatEventNotForwarded(name: string, reason: string): string {
    return `The runtime's event ${name} could not be passed to the window: ${reason}`;
  }

  public static get openApplicationLabel(): string {
    return `Open ${Resources.applicationName}`;
  }

  public static get quitApplicationLabel(): string {
    return `Quit ${Resources.applicationName}`;
  }

  public static formatMoreWork(count: number): string {
    return `and ${count} more`;
  }

  public static formatTrayToolTip(running: number, unread: number): string {
    const parts = [...running > 0 ? [`${running} running`] : [], ...unread > 0 ? [`${unread} unread`] : []];
    return parts.length === 0 ? Resources.applicationName : `${Resources.applicationName}: ${parts.join(", ")}`;
  }

  public static formatSettingNotRead(name: string, reason: string): string {
    return `The setting ${name} could not be read for this device, so the desktop keeps its last value: ${reason}`;
  }

  public static formatTrayNotShown(reason: string): string {
    return `The tray icon could not be shown: ${reason}`;
  }

  public static formatTrayStateNotRead(reason: string): string {
    return `The tray icon could not read the runtime's work and notifications: ${reason}`;
  }

  public static formatDoNotDisturbNotSet(reason: string): string {
    return `Do not disturb could not be changed from the tray: ${reason}`;
  }

  public static formatWorkNotRead(reason: string): string {
    return `The runtime's work could not be read before quitting, so ${Resources.applicationName} quits without asking: ${reason}`;
  }

  public static formatRuntimeNotStopped(reason: string): string {
    return `The runtime could not be stopped as ${Resources.applicationName} quits: ${reason}`;
  }

  public static get trayCloseHintTitle(): string {
    return `${Resources.applicationName} is still running`;
  }

  public static formatTrayCloseHintBody(platform: string): string {
    return `Open it again or quit it from its icon in the ${platform === Resources.windowsPlatform ? "notification area" : "tray"}.`;
  }

  public static formatTrayCloseHintFailed(reason: string): string {
    return `The operating system did not show the hint that ${Resources.applicationName} is still running, so it counts as not shown: ${reason}`;
  }

  public static formatDeviceStateNotRead(reason: string): string {
    return `The device's state could not be read, so its hints count as not shown and the tray icon follows its default until the runtime answers: ${reason}`;
  }

  public static formatDeviceStateUnsaved(key: string, reason: string): string {
    return `The device could not record ${key} in its state: ${reason}`;
  }

  public static formatModuleLogLine(moduleId: string, line: string): string {
    return `${moduleId}: ${line}`;
  }

  public static formatWindowErrorLine(moduleId: string | null, line: string): string {
    return Object.isNull(moduleId) ? `Window error: ${line}` : `Window error in ${moduleId}: ${line}`;
  }

  public static formatBoundsUnsaved(reason: string): string {
    return `The window's bounds could not be saved: ${reason}`;
  }

  public static formatBoundsLostAtClose(reason: string): string {
    return `The window closed without saving its bounds, because the runtime could not be reached; the last position is lost: ${reason}`;
  }

  public static formatBoundsNotRestored(reason: string): string {
    return `The window's saved bounds could not be restored, so it opens with its default bounds: ${reason}`;
  }

  public static formatMethodRefused(method: string): string {
    return `The window may not call ${method}; the desktop calls the shell's methods itself.`;
  }

  public static formatLogFolderNotOpened(reason: string): string {
    return `The log folder could not be opened: ${reason}`;
  }

  public static formatLinkNotOpened(reason: string): string {
    return `A link could not be opened: ${reason}`;
  }

  public static formatAdministratorPrompt(link: string): string {
    return `${Resources.applicationName} wants to link ${link} to its ${Resources.commandName} command, so that terminals can run it.`;
  }

  public static formatCommandInstalledDetail(link: string): string {
    return `${link} links to the command inside ${Resources.applicationName}. Terminals opened from now on run it as ${Resources.commandName}.`;
  }

  public static formatCommandAlreadyInstalledDetail(link: string): string {
    return `${link} already links to the command inside this ${Resources.applicationName}.`;
  }

  public static formatCommandOccupiedDetail(link: string): string {
    return `${link} is a file that is not a link, so ${Resources.applicationName} leaves it alone. Move or remove it, then install the command again.`;
  }

  public static formatPathCommandFailed(link: string, reason: string): string {
    return `The ${Resources.commandName} command could not be linked at ${link}: ${reason}`;
  }

  public static formatProgramFailed(file: string, reason: string): string {
    return `${file} failed: ${reason}`;
  }

  public static formatSystemNotificationFailed(reason: string): string {
    return `The operating system did not show a notification: ${reason}`;
  }

  public static formatNotificationsNotRead(reason: string): string {
    return `The notifications could not be read, so the operating system shows none until the window reads them again: ${reason}`;
  }

  public static formatDeviceUnavailable(reason: string): string {
    return `This device's identity could not be read, so window bounds are not kept: ${reason}`;
  }

  public static formatStarterFailed(failure: string): string {
    return `The runtime starter could not start the runtime: ${failure}`;
  }

  public static formatUpdateWork(description: string, dataDirectory: string): string {
    return `${description} (${dataDirectory})`;
  }

  public static formatWorkStartedMeanwhile(work: string): string {
    return `Work started while ${Resources.applicationName} prepared to update: ${work}`;
  }

  public static formatUpdateRefused(dataDirectory: string, message: string): string {
    return `The runtime of ${dataDirectory} could not prepare for the update: ${message}`;
  }

  public static formatUpdateUnsaved(dataDirectory: string, problems: string): string {
    return `Not everything of ${dataDirectory} was saved: ${problems}`;
  }

  public static formatProcessesNotExited(processes: string): string {
    return `These processes did not exit within 10 seconds: ${processes}`;
  }

  public static formatUpdateSavedUnsent(message: string): string {
    return `The runtime was not told that the windows had saved for the update: ${message}`;
  }

  public static formatRuntimeNotStarted(reason: string): string {
    return `The runtime could not be started or reached, so the window offers to try again: ${reason}`;
  }

  public static formatDictionariesUnread(reason: string): string {
    return `The list of shipped dictionaries could not be read, so no spelling language is offered: ${reason}`;
  }

  public static formatDictionaryUncopied(reason: string): string {
    return `A shipped dictionary could not be put in the profile, so its language is not offered: ${reason}`;
  }

  public static formatDictionaryFieldInvalid(value: string): string {
    return `"${value}" is not a language tag or a dictionary file name.`;
  }

  public static formatSpellingLanguagesRefused(languages: string, reason: string): string {
    return `The spell checker refused the languages ${languages}: ${reason}`;
  }

  public static formatSpellingRejected(reason: string): string {
    return `The window's spelling preferences were rejected: ${reason}`;
  }

  public static formatAppearanceUnread(reason: string): string {
    return `The device's last appearance could not be read, so the window starts in the default appearance: ${reason}`;
  }

  public static formatAppearanceUnsaved(reason: string): string {
    return `The device's appearance could not be kept for the next start: ${reason}`;
  }

  public static formatPreferencesRejected(reason: string): string {
    return `The window's appearance preferences are not valid, so they are not kept: ${reason}`;
  }

  public static formatMenuBarRejected(reason: string): string {
    return `The window sent a menu bar that is not valid, so the menu bar is unchanged: ${reason}`;
  }

  public static formatAppearanceRejected(reason: string): string {
    return `The window reported an appearance that is not valid, so it is shown without it: ${reason}`;
  }

  public static formatDesktopLogUnavailable(reason: string): string {
    return `The desktop's log could not be written, so its records go to standard error only: ${reason}`;
  }

  public static formatWindowShownUnpainted(seconds: number, isLoading: boolean, isCrashed: boolean): string {
    const page = isCrashed ? "its page has crashed" : isLoading ? "its page is still loading" : "its page loaded but did not report its first paint";
    return `The window was shown before it was painted, ${seconds} s after it opened, because ${page}.`;
  }

  public static formatRendererGone(reason: string, exitCode: number): string {
    return `The window's page stopped: ${reason}, exit code ${exitCode}.`;
  }

  public static formatRendererEnded(processId: number): string {
    return `The window's page did not stop when asked, so the desktop ended its process ${processId}.`;
  }

  public static formatNoRendererToEnd(processId: number): string {
    return `The window's page did not stop when asked and has no renderer process of its own to end (${processId}), so the desktop reloads it.`;
  }

  public static formatRendererNotEnded(reason: string): string {
    return `The window's page did not stop when asked, and its process could not be ended, so the desktop reloads it: ${reason}`;
  }

  public static formatRecoveryChoice(choice: string): string {
    return `The person chose ${choice}.`;
  }

  public static formatMainProcessFailure(kind: MainProcessFailureKind, error: string): string {
    return `The desktop's main process failed with ${kind === MainProcessFailureKind.UnhandledRejection ? "an unhandled rejection" : "an uncaught exception"}: ${error}`;
  }

  public static formatMainProcessBoxFailed(error: string): string {
    return `The desktop could not ask what to do after its main process failed, so it quits: ${error}`;
  }

  public static formatWindowSize(name: string, minimum: number): string {
    return `The window ${name} is a whole number of at least ${minimum} pixels.`;
  }
}
