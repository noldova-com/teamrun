/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ShellMethods } from "@noldova/teamrun-shell-protocol";

export class Resources {
  public static readonly folderSeparator: string = "/";
  public static readonly applicationName: string = "__PRODUCT_NAME__";
  public static readonly appUserModelId: string = "__APPLICATION_ID__";
  public static readonly developmentAppUserModelId: string = "__DEVELOPMENT_APPLICATION_ID__";
  public static readonly relaunchArgumentPrefixes: readonly string[] = ["--data-dir=", "--user-data-dir=", "--device-dir="];
  public static readonly appIdParameter: string = "appId";
  public static readonly iconPathParameter: string = "iconPath";
  public static readonly relaunchCommandParameter: string = "relaunchCommand";
  public static readonly readyChannel: string = "teamrun:ready";
  public static readonly closeRequestChannel: string = "teamrun:closeRequest";
  public static readonly closeAnswerChannel: string = "teamrun:closeAnswer";
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
  public static readonly copyTextLimit: number = 65536;
  public static readonly shellOwner: string = "shell";
  public static readonly methodParameter: string = "method";
  public static readonly windowShellMethods: readonly string[] = [ShellMethods.modules.text];
  public static readonly untrustedRequest: string = `Only ${Resources.applicationName}'s own window may call the runtime.`;
  public static readonly methodNotText: string = "The method must be a qualified name such as notes.open.";
  public static readonly payloadNotJson: string = "The payload must be a JSON value.";
  public static readonly layoutNotObject: string = "The layout must be a JSON object.";
  public static readonly clientName: string = "desktop";
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
  public static readonly deviceDirectoryArgument: string = "--device-dir=";
  public static readonly windowsPlatform: string = "win32";
  public static readonly localAppDataVariable: string = "LOCALAPPDATA";
  public static readonly windowsLocalAppData: readonly string[] = ["AppData", "Local"];
  public static readonly windowsDeviceFolder: readonly string[] = "__WINDOWS_DEVICE_FOLDER__".split(Resources.folderSeparator);
  public static readonly macDeviceFolder: readonly string[] = ["Library", "Application Support", ..."__MACOS_DEVICE_FOLDER__".split(Resources.folderSeparator)];
  public static readonly xdgStateVariable: string = "XDG_STATE_HOME";
  public static readonly xdgStateDefault: readonly string[] = [".local", "state"];
  public static readonly linuxDeviceFolder: readonly string[] = "__LINUX_DEVICE_FOLDER__".split(Resources.folderSeparator);
  public static readonly deviceFileName: string = "device.json";
  public static readonly deviceIdField: string = "id";
  public static readonly createOnlyFlag: string = "wx";
  public static readonly textEncoding: BufferEncoding = "utf8";
  public static readonly uuidPattern: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  public static readonly hashPrefix: string = "#";
  public static readonly queryPrefix: string = "?";
  public static readonly macPlatform: string = "darwin";
  public static readonly preloadFileName: string = "preload.cjs";
  public static readonly repositoryRootSegments: readonly string[] = ["..", "..", ".."];
  public static readonly windowIndexSegments: readonly string[] = ["_build", "window", "browser", "index.html"];
  public static readonly platformParameter: string = "platform";
  public static readonly windowIndexParameter: string = "windowIndexPath";
  public static readonly preloadParameter: string = "preloadPath";
  public static readonly hiddenTitleBarStyle: "hidden" = "hidden";
  public static readonly denyWindowOpen: "deny" = "deny";
  public static readonly trafficLightPosition: Readonly<{ x: number; y: number }> = { x: 12, y: 10 };
  public static readonly willNavigateEvent: "will-navigate" = "will-navigate";
  public static readonly willRedirectEvent: "will-redirect" = "will-redirect";
  public static readonly willAttachWebviewEvent: "will-attach-webview" = "will-attach-webview";
  public static readonly closeEvent: "close" = "close";
  public static readonly closedEvent: "closed" = "closed";
  public static readonly secondInstanceEvent: "second-instance" = "second-instance";
  public static readonly windowAllClosedEvent: "window-all-closed" = "window-all-closed";
  public static readonly activateEvent: "activate" = "activate";
  public static readonly willQuitEvent: "will-quit" = "will-quit";
  public static readonly resizeEvent: "resize" = "resize";
  public static readonly moveEvent: "move" = "move";
  public static readonly maximizeEvent: "maximize" = "maximize";
  public static readonly unmaximizeEvent: "unmaximize" = "unmaximize";
  public static readonly boundsSaveDelay: number = 500;
  public static readonly connectingShowLimit: number = 2_000;
  public static readonly paintShowLimit: number = 10_000;
  public static readonly logLineSeparator: string = "\n";
  public static readonly logFileMode: number = 0o600;
  public static readonly reloadCrashLimit: number = 10_000;
  public static readonly rendererEndLimit: number = 5_000;
  public static readonly renderProcessGoneEvent: "render-process-gone" = "render-process-gone";
  public static readonly unresponsiveEvent: "unresponsive" = "unresponsive";
  public static readonly responsiveEvent: "responsive" = "responsive";
  public static readonly cleanExitReason: string = "clean-exit";
  public static readonly warningBoxType: "warning" = "warning";
  public static readonly windowStopped: string = `${Resources.applicationName}'s window stopped unexpectedly.`;
  public static readonly windowStoppedDetail: string = "Reload it to continue. Your layout comes back from the last save.";
  public static readonly windowStoppedAgainDetail: string = "It stopped again right after it was reloaded. The log folder has what it recorded.";
  public static readonly windowNotResponding: string = `${Resources.applicationName}'s window isn't responding.`;
  public static readonly windowNotRespondingDetail: string = "You can wait for it or reload it.";
  public static readonly reloadButton: string = "Reload";
  public static readonly quitButton: string = "Quit";
  public static readonly waitButton: string = "Wait";
  public static readonly openLogFolderButton: string = "Open log folder";
  public static readonly windowUnresponsive: string = "The window's page stopped responding.";
  public static readonly windowResponsiveAgain: string = "The window's page responds again.";
  public static readonly windowStoppedAgainRecord: string = "The window's page stopped again within 10 s of a reload, so the person was offered the log folder instead of another reload.";
  public static readonly mainWindow: string = "main";
  public static readonly runtimeNotConnected: string = `${Resources.applicationName} is not connected to its runtime.`;
  public static readonly deviceNotIdentified: string = "This device has no identity, so the window's layout is not kept.";
  public static readonly windowMinimumWidth: number = 640;
  public static readonly windowMinimumHeight: number = 400;
  public static readonly windowWidth: number = 1280;
  public static readonly windowHeight: number = 800;
  public static readonly closeAnswerTimeout: number = 5000;
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
  public static readonly starterServiceName: string = `${Resources.applicationName} runtime starter`;
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
  public static readonly timeoutParameter: string = "timeout";
  public static readonly backgroundField: string = "background";
  public static readonly titleBarField: string = "titleBar";
  public static readonly titleBarTextField: string = "titleBarText";
  public static readonly titleBarHeightField: string = "titleBarHeight";
  public static readonly invalidAppearance: string = "The window appearance is not valid.";
  public static readonly invalidColor: string = "A window color is a hexadecimal color or an rgb() or rgba() color.";
  public static readonly colorPattern: RegExp = /^(?:#[0-9A-Fa-f]{3,8}|rgba?\([0-9., %/]+\))$/;

  public static formatInvalidDevice(file: string): string {
    return `The device identity in ${file} is not valid; remove the file to give this device a new identity.`;
  }

  public static formatWindowStateFailed(method: string, message: string): string {
    return `The runtime refused ${method}: ${message}`;
  }

  public static formatBoundsUnsaved(reason: string): string {
    return `The window's bounds could not be saved: ${reason}`;
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

  public static formatDeviceUnavailable(reason: string): string {
    return `This device's identity could not be read, so window bounds are not kept: ${reason}`;
  }

  public static formatStarterFailed(failure: string): string {
    return `The runtime starter could not start the runtime: ${failure}`;
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

  public static formatRendererNotEnded(reason: string): string {
    return `The window's page did not stop when asked, and its process could not be ended: ${reason}`;
  }

  public static formatRecoveryChoice(choice: string): string {
    return `The person chose ${choice}.`;
  }

  public static formatWindowSize(name: string, minimum: number): string {
    return `The window ${name} is a whole number of at least ${minimum} pixels.`;
  }
}
