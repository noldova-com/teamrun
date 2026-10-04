/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import type {
  AppDetailsOptions, BrowserWindowConstructorOptions, MenuItemConstructorOptions, MessageBoxOptions, MessageBoxReturnValue, NotificationConstructorOptions, Rectangle, RenderProcessGoneDetails,
  TitleBarOverlayOptions, WindowOpenHandlerResponse
} from "electron";

import { Exception, type ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import type { Event, NotificationBroadcast, QualifiedName, Response, RuntimeHandover, StopPolicy, WindowStateKey, WorkReport } from "@noldova/teamrun-shell-protocol";
import type { DataDirectory, DiagnosticRedactor, IProcessStarter, IRuntimeClientListener, LaunchSettings } from "@noldova/teamrun-shell-runtime";

/**
 * Where starting or attaching to the runtime stands, as the window shows it.
 */
export declare enum StartupStateKind {
  /**
   * The desktop is starting or attaching to the runtime.
   */
  Connecting = "Connecting",

  /**
   * The data directory holds data from before the shell; the person may move it aside.
   */
  PreShellData = "PreShellData",

  /**
   * An older build's runtime has work in progress; the person chooses to wait for it or stop it.
   */
  WorkInProgress = "WorkInProgress",

  /**
   * The desktop waits for an older build's work to finish.
   */
  WaitingForWork = "WaitingForWork",

  /**
   * A newer build's runtime owns the data directory and this build cannot start it.
   */
  NewerBuild = "NewerBuild",

  /**
   * The runtime could not be started or reached; the person may try again.
   */
  Failed = "Failed",

  /**
   * The desktop is connected to the runtime.
   */
  Ready = "Ready"
}

/**
 * The person's answer when quitting while work is in progress, as the window sends it.
 */
export declare enum QuitChoice {
  /**
   * Wait for the work to finish, then quit.
   */
  Wait = "Wait",

  /**
   * Stop the work and quit.
   */
  Stop = "Stop",

  /**
   * Keep TeamRun open.
   */
  Cancel = "Cancel"
}

/**
 * Whether closing the last window may go ahead.
 */
export declare enum QuitOutcome {
  /**
   * Close; no work is in progress, it finished, or it could not be read.
   */
  Quit = "Quit",

  /**
   * Close, then stop the runtime's work.
   */
  StopWork = "StopWork",

  /**
   * Keep the window open.
   */
  Stay = "Stay"
}

/**
 * A window that can show the question about work in progress.
 */
export interface IQuitPrompt {
  /**
   * Shows the question, or takes it away.
   *
   * @param question The question, or `null` to take it away.
   * @returns Whether the window can show it.
   * @example
   * ```ts
   * import type { IQuitPrompt } from "@noldova/teamrun-shell-desktop";
   *
   * export function dismiss(prompt: IQuitPrompt): boolean {
   *   return prompt.show(null);
   * }
   * ```
   */
  show(question: QuitQuestion | null): boolean;
}

/**
 * Decides whether closing a window may go ahead while work is in progress.
 */
export interface ICloseGuard {
  /**
   * Decides whether the window may close, asking the person when it is the last window and the runtime has work in
   * progress.
   *
   * @param prompt The closing window.
   * @returns A promise of the outcome.
   * @example
   * ```ts
   * import { type ICloseGuard, type IQuitPrompt, QuitOutcome } from "@noldova/teamrun-shell-desktop";
   *
   * export async function mayCloseAsync(guard: ICloseGuard, prompt: IQuitPrompt): Promise<boolean> {
   *   return await guard.confirmAsync(prompt) !== QuitOutcome.Stay;
   * }
   * ```
   */
  confirmAsync(prompt: IQuitPrompt): Promise<QuitOutcome>;

  /**
   * Stops the runtime's work, once the windows have saved, when the person chose to.
   *
   * @returns A promise that settles once the runtime has answered or could not be reached.
   * @example
   * ```ts
   * import type { ICloseGuard } from "@noldova/teamrun-shell-desktop";
   *
   * export function stopAsync(guard: ICloseGuard): Promise<void> {
   *   return guard.stopWorkAsync();
   * }
   * ```
   */
  stopWorkAsync(): Promise<void>;
}

/**
 * The question a window shows about work in progress when the person quits.
 */
export declare class QuitQuestion {
  /**
   * The work in progress, as the person reads it.
   */
  public readonly descriptions: readonly string[];

  /**
   * Whether the person chose to wait and TeamRun quits when the work finishes.
   */
  public readonly isWaiting: boolean;

  /**
   * Creates the question.
   *
   * @param descriptions The work in progress.
   * @param isWaiting Whether the person chose to wait.
   * @example
   * ```ts
   * import { QuitQuestion } from "@noldova/teamrun-shell-desktop";
   *
   * export const question: QuitQuestion = new QuitQuestion(["Indexing the project"], false);
   * ```
   */
  public constructor(descriptions: readonly string[], isWaiting: boolean);

  /**
   * Returns the form the window receives.
   *
   * @returns The `descriptions` and `isWaiting` fields.
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { QuitQuestion } from "@noldova/teamrun-shell-desktop";
   *
   * export const json: JsonObject = new QuitQuestion([], true).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Asks the person before the last window closes while the runtime has work in progress, and decides from the answer
 * and the runtime's reports of its work. Reading the work is bounded once; when it fails or times out, closing goes
 * ahead as it would without work. Reports carry a sequence, so a report heard before an older answer is handled still
 * wins.
 */
export declare class QuitCoordinator implements ICloseGuard {
  /**
   * Creates the coordinator.
   *
   * @param isLast Whether a window is the last one open, so closing it quits.
   * @param readWorkAsync Reads the runtime's work within its time limit, or `null` when it cannot.
   * @param stopAsync Stops the runtime's work.
   * @example
   * ```ts
   * import { WorkReport } from "@noldova/teamrun-shell-protocol";
   * import { QuitCoordinator } from "@noldova/teamrun-shell-desktop";
   *
   * export const coordinator: QuitCoordinator = new QuitCoordinator(() => true, async () => new WorkReport([], 0), async () => undefined);
   * ```
   */
  public constructor(isLast: (prompt: IQuitPrompt) => boolean, readWorkAsync: () => Promise<WorkReport | null>, stopAsync: () => Promise<void>);

  /**
   * See {@link ICloseGuard.confirmAsync}. While a question is open, the window shows the newest work; closing goes
   * ahead once no work is left, the window can no longer show the question, or the runtime is gone. A second request
   * while one is open stays.
   *
   * @param prompt The closing window.
   * @returns A promise of the outcome.
   * @example
   * ```ts
   * import type { IQuitPrompt, QuitCoordinator, QuitOutcome } from "@noldova/teamrun-shell-desktop";
   *
   * export function confirmAsync(coordinator: QuitCoordinator, prompt: IQuitPrompt): Promise<QuitOutcome> {
   *   return coordinator.confirmAsync(prompt);
   * }
   * ```
   */
  public confirmAsync(prompt: IQuitPrompt): Promise<QuitOutcome>;

  /**
   * See {@link ICloseGuard.stopWorkAsync}.
   *
   * @returns A promise that settles once the work was asked to stop.
   * @example
   * ```ts
   * import type { QuitCoordinator } from "@noldova/teamrun-shell-desktop";
   *
   * export function stopAsync(coordinator: QuitCoordinator): Promise<void> {
   *   return coordinator.stopWorkAsync();
   * }
   * ```
   */
  public stopWorkAsync(): Promise<void>;

  /**
   * Takes a `shell.work` event into account while a question is being prepared or is open.
   *
   * @param report The runtime's report.
   * @example
   * ```ts
   * import { WorkReport } from "@noldova/teamrun-shell-protocol";
   * import type { QuitCoordinator } from "@noldova/teamrun-shell-desktop";
   *
   * export function heard(coordinator: QuitCoordinator): void {
   *   coordinator.receive(new WorkReport([], 4));
   * }
   * ```
   */
  public receive(report: WorkReport): void;

  /**
   * Takes the person's answer from the window that shows the question.
   *
   * @param prompt The window that answered.
   * @param choice The answer, one of {@link QuitChoice}.
   * @returns Whether the answer was taken: false for another window, no open question or an unknown answer.
   * @example
   * ```ts
   * import { type IQuitPrompt, QuitChoice, type QuitCoordinator } from "@noldova/teamrun-shell-desktop";
   *
   * export function wait(coordinator: QuitCoordinator, prompt: IQuitPrompt): boolean {
   *   return coordinator.answer(prompt, QuitChoice.Wait);
   * }
   * ```
   */
  public answer(prompt: IQuitPrompt, choice: unknown): boolean;

  /**
   * Lets an open question close and closing go ahead, because the runtime is gone.
   *
   * @example
   * ```ts
   * import type { QuitCoordinator } from "@noldova/teamrun-shell-desktop";
   *
   * export function disconnected(coordinator: QuitCoordinator): void {
   *   coordinator.release();
   * }
   * ```
   */
  public release(): void;
}

/**
 * The process the desktop runs in: its arguments, environment and platform, and how it starts another program.
 */
export interface IDesktopProcess {
  /**
   * The command-line arguments, including `--data-dir=` and `--user-data-dir=`.
   */
  readonly argv: readonly string[];

  /**
   * The environment, which a started runtime inherits.
   */
  readonly env: NodeJS.ProcessEnv;

  /**
   * The operating system, as Node.js names it.
   */
  readonly platform: string;

  /**
   * The program the desktop runs from, which also runs the runtime in Node mode.
   */
  readonly execPath: string;

  /**
   * The person's home folder.
   */
  readonly homeFolder: string;

  /**
   * The working directory the desktop started in, against which relative path arguments resolve.
   */
  readonly workingDirectory: string;

  /**
   * Whether Electron's default app runs the desktop's main script, as in every development start. A packaged build never
   * does, so this, not the program's name, tells a development start from a packaged build.
   */
  readonly isDefaultApp: boolean;

  /**
   * Standard error, which mirrors the desktop's log.
   */
  readonly errorOutput: Writable;

  /**
   * The desktop's own process id, which it never ends.
   */
  readonly processId: number;

  /**
   * Starts another program, detached, for the hand-over to a newer build.
   *
   * @param executablePath The program.
   * @param args Its arguments: the start's data directory, user data and
   * device directory arguments, so the newer build opens the same data.
   * @example
   * ```ts
   * import type { IDesktopProcess } from "@noldova/teamrun-shell-desktop";
   *
   * export function handOver(process: IDesktopProcess): void {
   *   process.startDetached("/opt/teamrun/teamrun", ["--data-dir=/home/person/work-data"]);
   * }
   * ```
   */
  startDetached(executablePath: string, args: readonly string[]): void;

  /**
   * Ends another process at once, for a window's page that did not stop when asked.
   *
   * @param processId The process.
   * @throws Error synchronously when the process cannot be ended, for example because it is gone.
   * @example
   * ```ts
   * import type { IDesktopProcess } from "@noldova/teamrun-shell-desktop";
   *
   * export function end(process: IDesktopProcess, processId: number): void {
   *   process.endProcess(processId);
   * }
   * ```
   */
  endProcess(processId: number): void;
}

/**
 * A connection to the runtime, as `RuntimeClient` provides it.
 */
export interface IRuntimeConnection {
  /**
   * Sends a request and waits for its response.
   *
   * @param method The method's qualified name.
   * @param payload The request's payload.
   * @param timeout How long to wait for the response, in milliseconds; the
   * connection's own limit by default.
   * @returns A promise of the response, successful or failed.
   * @throws {ConnectionException} Rejected when no response arrives in time
   * or the connection ends.
   * @example
   * ```ts
   * import { ShellMethods, WindowStateKey, type Response } from "@noldova/teamrun-shell-protocol";
   * import type { IRuntimeConnection } from "@noldova/teamrun-shell-desktop";
   *
   * export function readBoundsAsync(connection: IRuntimeConnection): Promise<Response> {
   *   return connection.callAsync(ShellMethods.readWindowBounds, new WindowStateKey("1b4e28ba-2fa1-41d2-883f-0016d3cca427", "main").toJson());
   * }
   * ```
   */
  callAsync(method: QualifiedName, payload: JsonValue, timeout?: number): Promise<Response>;

  /**
   * Closes the connection.
   *
   * @example
   * ```ts
   * import type { IRuntimeConnection } from "@noldova/teamrun-shell-desktop";
   *
   * export function disconnect(connection: IRuntimeConnection): void {
   *   connection.close();
   * }
   * ```
   */
  close(): void;
}

/**
 * The displays' work areas, as Electron's `screen` provides them.
 */
export interface IDisplayHost {
  /**
   * Lists the displays.
   *
   * @returns Each display, with its work area in screen pixels.
   * @example
   * ```ts
   * import type { IDisplayHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function countDisplays(displays: IDisplayHost): number {
   *   return displays.getAllDisplays().length;
   * }
   * ```
   */
  getAllDisplays(): readonly { readonly workArea: Rectangle }[];
}

/**
 * Keeps one window's state in a place that outlives the window.
 */
export interface IWindowStateStore {
  /**
   * Reads the kept state.
   *
   * @returns A promise of the state, or `null` when none is kept.
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import type { IWindowStateStore } from "@noldova/teamrun-shell-desktop";
   *
   * export function readAsync(store: IWindowStateStore): Promise<JsonObject | null> {
   *   return store.readAsync();
   * }
   * ```
   */
  readAsync(): Promise<JsonObject | null>;

  /**
   * Keeps a new state.
   *
   * @param value The state.
   * @returns A promise that settles once the state is kept.
   * @example
   * ```ts
   * import type { IWindowStateStore } from "@noldova/teamrun-shell-desktop";
   *
   * export function keepAsync(store: IWindowStateStore): Promise<void> {
   *   return store.writeAsync({ width: 1280, height: 800 });
   * }
   * ```
   */
  writeAsync(value: JsonObject): Promise<void>;
}

/**
 * Starts or attaches to the runtime of a data directory, as `RuntimeLauncher` does.
 */
export interface IRuntimeLauncher {
  /**
   * Connects to the data directory's runtime of this build, starting one when none runs.
   *
   * @param clientName The client's name.
   * @param listener Receives events and the disconnection.
   * @param policy What to do when an older runtime has work in progress.
   * @returns A promise of the connection.
   * @throws RuntimeHandoverException, PreShellDataFoundException, WorkInProgressException, LaunchException or ConnectionException
   * as a rejection, as `RuntimeLauncher.attachAsync` does.
   * @example
   * ```ts
   * import type { IRuntimeConnection, IRuntimeLauncher } from "@noldova/teamrun-shell-desktop";
   *
   * export function attachAsync(launcher: IRuntimeLauncher): Promise<IRuntimeConnection> {
   *   return launcher.attachAsync("desktop", { onEvent: () => undefined, onDisconnected: () => undefined });
   * }
   * ```
   */
  attachAsync(clientName: string, listener: IRuntimeClientListener, policy?: StopPolicy): Promise<IRuntimeConnection>;

  /**
   * Moves data from before the shell aside, then connects as {@link attachAsync} does.
   *
   * @param clientName The client's name.
   * @param listener Receives events and the disconnection.
   * @param policy What to do when an older runtime has work in progress.
   * @returns A promise of the connection, once the data is moved aside.
   * @throws The rejections of {@link attachAsync}, except PreShellDataFoundException.
   * @example
   * ```ts
   * import type { IRuntimeConnection, IRuntimeLauncher } from "@noldova/teamrun-shell-desktop";
   *
   * export function moveAsideAsync(launcher: IRuntimeLauncher): Promise<IRuntimeConnection> {
   *   return launcher.moveAsideAsync("desktop", { onEvent: () => undefined, onDisconnected: () => undefined });
   * }
   * ```
   */
  moveAsideAsync(clientName: string, listener: IRuntimeClientListener, policy?: StopPolicy): Promise<IRuntimeConnection>;
}

/**
 * An event whose default action a listener can cancel.
 */
export interface IPreventableEvent {
  /**
   * Cancels the event's default action.
   *
   * @example
   * ```ts
   * import type { IPreventableEvent } from "@noldova/teamrun-shell-desktop";
   *
   * export function refuse(event: IPreventableEvent): void {
   *   event.preventDefault();
   * }
   * ```
   */
  preventDefault(): void;
}

/**
 * The frame an IPC message came from.
 */
export interface ISenderFrame {
  /**
   * The frame's current URL.
   */
  readonly url: string;

  /**
   * The frame's parent; `null` for a top-level frame.
   */
  readonly parent: unknown;
}

/**
 * An IPC message's origin: the web contents and the frame that sent it.
 */
export interface IIpcEvent {
  /**
   * The sending web contents and its id.
   */
  readonly sender: { readonly id: number };

  /**
   * The sending frame; `null` when it is gone.
   */
  readonly senderFrame: ISenderFrame | null;
}

/**
 * The main process's side of IPC, as Electron's `ipcMain` provides it.
 */
export interface IIpcHost {
  /**
   * Listens for messages sent on a channel.
   *
   * @param channel The channel's name.
   * @param listener Receives the message's origin and values.
   * @returns Electron's own return value, which the desktop does not use.
   * @example
   * ```ts
   * import type { IIpcHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function listen(ipc: IIpcHost, received: unknown[]): void {
   *   ipc.on("teamrun:ready", (_event, appearance) => received.push(appearance));
   * }
   * ```
   */
  on(channel: string, listener: (event: IIpcEvent, ...values: unknown[]) => void): unknown;

  /**
   * Answers invocations on a channel.
   *
   * @param channel The channel's name.
   * @param listener Receives the invocation's origin and values and returns its answer.
   * @example
   * ```ts
   * import type { IIpcHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function answer(ipc: IIpcHost): void {
   *   ipc.handle("teamrun:closeAnswer", () => false);
   * }
   * ```
   */
  handle(channel: string, listener: (event: IIpcEvent, ...values: unknown[]) => unknown): void;
}

/**
 * The application's lifecycle, as Electron's `app` provides it.
 */
export interface IApplicationHost {
  /**
   * Whether this is a packaged build rather than a development run from a checkout.
   */
  readonly isPackaged: boolean;

  /**
   * The macOS Dock's entry for the application, absent on other systems.
   */
  readonly dock: IDockHost | undefined;

  /**
   * Sets the application's name.
   *
   * @param name The name.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function name(app: IApplicationHost): void {
   *   app.setName("TeamRun");
   * }
   * ```
   */
  setName(name: string): void;

  /**
   * Sets the application user model id that Windows groups the application's windows and notifications by.
   *
   * @param id The id.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function identify(app: IApplicationHost): void {
   *   app.setAppUserModelId("com.noldova.teamrun");
   * }
   * ```
   */
  setAppUserModelId(id: string): void;

  /**
   * Sets the name of the `.desktop` file the application belongs to on Linux. Electron derives its windows' `WM_CLASS`
   * from it, and desktop portals identify the application by it, so it is set before the application is ready.
   *
   * @param name The file's name, the application's id followed by `.desktop`.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function identify(app: IApplicationHost): void {
   *   app.setDesktopName("org.example.app.desktop");
   * }
   * ```
   */
  setDesktopName(name: string): void;

  /**
   * Sets where Electron keeps the application's own data, its caches and Chromium storage.
   *
   * @param name The path's name; the desktop sets only `userData`.
   * @param path The folder.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function keepProfile(app: IApplicationHost): void {
   *   app.setPath("userData", "/home/person/.noldova/teamrun/desktop");
   * }
   * ```
   */
  setPath(name: "userData", path: string): void;

  /**
   * Claims the single-instance lock.
   *
   * @returns `true` when this instance holds the lock; `false` when another instance runs.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function isFirst(app: IApplicationHost): boolean {
   *   return app.requestSingleInstanceLock();
   * }
   * ```
   */
  requestSingleInstanceLock(): boolean;

  /**
   * Runs every renderer in the sandbox.
   *
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function sandbox(app: IApplicationHost): void {
   *   app.enableSandbox();
   * }
   * ```
   */
  enableSandbox(): void;

  /**
   * Quits the application.
   *
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function stop(app: IApplicationHost): void {
   *   app.quit();
   * }
   * ```
   */
  quit(): void;

  /**
   * Waits until the application is ready to create windows.
   *
   * @returns A promise that settles when the application is ready.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/teamrun-shell-desktop";
   *
   * export async function waitAsync(app: IApplicationHost): Promise<void> {
   *   await app.whenReady();
   * }
   * ```
   */
  whenReady(): Promise<unknown>;

  /**
   * Listens for a lifecycle event: another instance starting, the last window closing, the application being
   * activated or about to quit.
   *
   * @param event The event's name.
   * @param listener Called on each occurrence.
   * @returns Electron's own return value, which the desktop does not use.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function quitWithLastWindow(app: IApplicationHost): void {
   *   app.on("window-all-closed", () => app.quit());
   * }
   * ```
   */
  on(event: "second-instance", listener: () => void): unknown;
  on(event: "window-all-closed", listener: () => void): unknown;
  on(event: "activate", listener: () => void): unknown;
  on(event: "will-quit", listener: () => void): unknown;
}

/**
 * The macOS Dock's entry for the application, as Electron's `app.dock` provides it.
 */
export interface IDockHost {
  /**
   * Shows an image as the application's icon in the Dock.
   *
   * @param iconPath The image's absolute path.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function showIcon(app: IApplicationHost, iconPath: string): void {
   *   app.dock?.setIcon(iconPath);
   * }
   * ```
   */
  setIcon(iconPath: string): void;
}

/**
 * Decides the permissions web contents ask for, as an Electron session provides it.
 */
export interface IPermissionHost {
  /**
   * Answers permission requests.
   *
   * @param handler Receives each request and grants or denies it through its callback.
   * @example
   * ```ts
   * import type { IPermissionHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function denyRequests(host: IPermissionHost): void {
   *   host.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
   * }
   * ```
   */
  setPermissionRequestHandler(handler: (contents: unknown, permission: string, callback: (isGranted: boolean) => void) => void): void;

  /**
   * Answers permission checks.
   *
   * @param handler Returns whether a permission is granted.
   * @example
   * ```ts
   * import type { IPermissionHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function denyChecks(host: IPermissionHost): void {
   *   host.setPermissionCheckHandler(() => false);
   * }
   * ```
   */
  setPermissionCheckHandler(handler: () => boolean): void;
}

/**
 * Electron's `session` module, as far as the desktop uses it.
 */
export interface ISessionHost {
  /**
   * The session the window's web contents use.
   */
  readonly defaultSession: IPermissionHost;
}

/**
 * Builds and sets the application menu, as Electron's `Menu` provides it.
 */
export interface IMenuHost {
  /**
   * Builds a menu from its items.
   *
   * @param template The menu's items.
   * @returns The menu.
   * @example
   * ```ts
   * import type { IMenuHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function buildEditMenu(host: IMenuHost): unknown {
   *   return host.buildFromTemplate([{ role: "editMenu" }]);
   * }
   * ```
   */
  buildFromTemplate(template: MenuItemConstructorOptions[]): unknown;

  /**
   * Sets the application menu.
   *
   * @param menu A menu from `buildFromTemplate`, or `null` for none.
   * @example
   * ```ts
   * import type { IMenuHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function removeMenu(host: IMenuHost): void {
   *   host.setApplicationMenu(null);
   * }
   * ```
   */
  setApplicationMenu(menu: unknown): void;
}

/**
 * Writes to the system clipboard, as Electron's `clipboard` provides it.
 */
export interface IClipboardHost {
  /**
   * Replaces the clipboard's contents with plain text.
   *
   * @param text The text to copy.
   * @example
   * ```ts
   * import type { IClipboardHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function copyVersion(host: IClipboardHost, version: string): void {
   *   host.writeText(`TeamRun ${version}`);
   * }
   * ```
   */
  writeText(text: string): void;
}

/**
 * Opens files and folders in the system's own application, as Electron's `shell` provides it.
 */
export interface IShellHost {
  /**
   * Opens a file or folder, such as a folder in the system's file manager.
   *
   * @param path The absolute path to open.
   * @returns An empty string once it opens, or the system's reason it could not.
   * @example
   * ```ts
   * import type { IShellHost } from "@noldova/teamrun-shell-desktop";
   *
   * export async function openFolderAsync(host: IShellHost, folder: string): Promise<boolean> {
   *   return (await host.openPath(folder)).length === 0;
   * }
   * ```
   */
  openPath(path: string): Promise<string>;
}

/**
 * A window's web contents, as Electron's `WebContents` provides them.
 */
export interface IWindowContents {
  /**
   * The web contents' id, which IPC events name as their sender.
   */
  readonly id: number;

  /**
   * Listens for a navigation, a redirect or a webview being attached, each of which the listener may cancel.
   *
   * @param event The event's name.
   * @param listener Receives the cancellable event and, for a navigation or a redirect, the target URL.
   * @returns Electron's own return value, which the desktop does not use.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/teamrun-shell-desktop";
   *
   * export function stayOnPage(contents: IWindowContents, page: string): void {
   *   contents.on("will-navigate", (event, url) => {
   *     if (url !== page)
   *       event.preventDefault();
   *   });
   * }
   * ```
   */
  on(event: "will-navigate", listener: (event: IPreventableEvent, url: string) => void): unknown;
  on(event: "will-redirect", listener: (event: IPreventableEvent, url: string) => void): unknown;
  on(event: "will-attach-webview", listener: (event: IPreventableEvent) => void): unknown;

  /**
   * Listens for the page's renderer process having gone, for any reason including a clean exit.
   *
   * @param event The event's name.
   * @param listener Receives Electron's event, which the desktop does not use, and why the process went.
   * @returns Electron's own return value, which the desktop does not use.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/teamrun-shell-desktop";
   *
   * export function watch(contents: IWindowContents, record: (reason: string) => void): void {
   *   contents.on("render-process-gone", (_event, details) => record(details.reason));
   * }
   * ```
   */
  on(event: "render-process-gone", listener: (event: unknown, details: RenderProcessGoneDetails) => void): unknown;

  /**
   * Listens for the page starting to load, on the first load and on every reload, before any of its scripts run.
   *
   * @param event The event's name.
   * @param listener Called each time the page starts loading.
   * @returns Electron's own return value, which the desktop does not use.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/teamrun-shell-desktop";
   *
   * export function count(contents: IWindowContents, loads: { count: number }): void {
   *   contents.on("did-start-loading", () => loads.count++);
   * }
   * ```
   */
  on(event: "did-start-loading", listener: () => void): unknown;

  /**
   * Decides what happens when the page asks to open a window.
   *
   * @param handler Returns the decision.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/teamrun-shell-desktop";
   *
   * export function denyWindows(contents: IWindowContents): void {
   *   contents.setWindowOpenHandler(() => ({ action: "deny" }));
   * }
   * ```
   */
  setWindowOpenHandler(handler: () => WindowOpenHandlerResponse): void;

  /**
   * Sends a message to the page.
   *
   * @param channel The channel's name.
   * @param values The message's values.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/teamrun-shell-desktop";
   *
   * export function askToClose(contents: IWindowContents): void {
   *   contents.send("teamrun:closeRequest", "request-1");
   * }
   * ```
   */
  send(channel: string, ...values: unknown[]): void;

  /**
   * Tells whether the page is still loading.
   *
   * @returns Whether it is loading.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/teamrun-shell-desktop";
   *
   * export function isLoading(contents: IWindowContents): boolean {
   *   return contents.isLoading();
   * }
   * ```
   */
  isLoading(): boolean;

  /**
   * Tells whether the page's renderer process has crashed.
   *
   * @returns Whether it has crashed.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/teamrun-shell-desktop";
   *
   * export function hasCrashed(contents: IWindowContents): boolean {
   *   return contents.isCrashed();
   * }
   * ```
   */
  isCrashed(): boolean;

  /**
   * Loads the page again, starting a new renderer process when the old one has gone.
   *
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/teamrun-shell-desktop";
   *
   * export function reload(contents: IWindowContents): void {
   *   contents.reload();
   * }
   * ```
   */
  reload(): void;

  /**
   * Ends the page's renderer process at once, which recovers a page that no longer responds before a reload.
   *
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/teamrun-shell-desktop";
   *
   * export function restart(contents: IWindowContents): void {
   *   contents.forcefullyCrashRenderer();
   *   contents.reload();
   * }
   * ```
   */
  forcefullyCrashRenderer(): void;

  /**
   * Undoes the last edit in the page's focused field.
   *
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/teamrun-shell-desktop";
   *
   * export function undo(contents: IWindowContents): void {
   *   contents.undo();
   * }
   * ```
   */
  undo(): void;

  /**
   * Redoes the last edit undone in the page's focused field.
   *
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/teamrun-shell-desktop";
   *
   * export function redo(contents: IWindowContents): void {
   *   contents.redo();
   * }
   * ```
   */
  redo(): void;

  /**
   * Cuts the page's selection in its focused field to the clipboard.
   *
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/teamrun-shell-desktop";
   *
   * export function cut(contents: IWindowContents): void {
   *   contents.cut();
   * }
   * ```
   */
  cut(): void;

  /**
   * Copies the page's selection to the clipboard.
   *
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/teamrun-shell-desktop";
   *
   * export function copy(contents: IWindowContents): void {
   *   contents.copy();
   * }
   * ```
   */
  copy(): void;

  /**
   * Pastes the clipboard into the page's focused field, replacing its selection.
   *
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/teamrun-shell-desktop";
   *
   * export function paste(contents: IWindowContents): void {
   *   contents.paste();
   * }
   * ```
   */
  paste(): void;

  /**
   * Selects all of the page's focused field, or all of the page when no field has focus.
   *
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/teamrun-shell-desktop";
   *
   * export function selectAll(contents: IWindowContents): void {
   *   contents.selectAll();
   * }
   * ```
   */
  selectAll(): void;

  /**
   * Returns the operating system's id of the page's renderer process.
   *
   * @returns The process id.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/teamrun-shell-desktop";
   *
   * export function rendererOf(contents: IWindowContents): number {
   *   return contents.getOSProcessId();
   * }
   * ```
   */
  getOSProcessId(): number;
}

/**
 * One notification shown through the operating system, as Electron's `Notification` provides it.
 */
export interface ISystemNotification {
  /**
   * Shows the notification without taking focus.
   *
   * @example
   * ```ts
   * import type { INotificationHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function announce(host: INotificationHost): void {
   *   host.create({ title: "Saved" }).show();
   * }
   * ```
   */
  show(): void;

  /**
   * Removes the notification from the screen and the operating system's list.
   *
   * @example
   * ```ts
   * import type { ISystemNotification } from "@noldova/teamrun-shell-desktop";
   *
   * export function withdraw(notification: ISystemNotification): void {
   *   notification.close();
   * }
   * ```
   */
  close(): void;

  /**
   * Listens for the person clicking the notification.
   *
   * @param event `"click"`.
   * @param listener Called on each click.
   * @returns Electron's notification, for chaining.
   * @example
   * ```ts
   * import type { ISystemNotification } from "@noldova/teamrun-shell-desktop";
   *
   * export function follow(notification: ISystemNotification, open: () => void): void {
   *   notification.on("click", open);
   * }
   * ```
   */
  on(event: "click", listener: () => void): unknown;

  /**
   * Listens for the notification closing, by the person or from code.
   *
   * @param event `"close"`.
   * @param listener Called once it closes.
   * @returns Electron's notification, for chaining.
   * @example
   * ```ts
   * import type { ISystemNotification } from "@noldova/teamrun-shell-desktop";
   *
   * export function forget(notification: ISystemNotification, shown: Set<ISystemNotification>): void {
   *   notification.on("close", () => shown.delete(notification));
   * }
   * ```
   */
  on(event: "close", listener: () => void): unknown;

  /**
   * Listens for the operating system failing to show the notification; Windows reports it.
   *
   * @param event `"failed"`.
   * @param listener Called with the operating system's reason.
   * @returns Electron's notification, for chaining.
   * @example
   * ```ts
   * import type { ISystemNotification } from "@noldova/teamrun-shell-desktop";
   *
   * export function report(notification: ISystemNotification, write: (text: string) => void): void {
   *   notification.on("failed", (_event, error) => write(error));
   * }
   * ```
   */
  on(event: "failed", listener: (event: unknown, error: string) => void): unknown;
}

/**
 * The operating system's notification service, as Electron's `Notification` class provides it.
 */
export interface INotificationHost {
  /**
   * Whether the operating system has a notification service.
   *
   * @returns `true` when notifications can show.
   * @example
   * ```ts
   * import type { INotificationHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function canNotify(host: INotificationHost): boolean {
   *   return host.isSupported();
   * }
   * ```
   */
  isSupported(): boolean;

  /**
   * Creates a notification without showing it.
   *
   * @param options Its title, text and icon.
   * @returns The notification.
   * @example
   * ```ts
   * import type { INotificationHost, ISystemNotification } from "@noldova/teamrun-shell-desktop";
   *
   * export function prepare(host: INotificationHost): ISystemNotification {
   *   return host.create({ title: "Saved", body: "Plan.md" });
   * }
   * ```
   */
  create(options: NotificationConstructorOptions): ISystemNotification;
}

/**
 * Native message boxes, as Electron's `dialog` provides them; the desktop uses them only when its window's page cannot
 * draw.
 */
export interface IDialogHost {
  /**
   * Shows a message box on a window, or on its own when the window is gone.
   *
   * @param windowId The window's id.
   * @param options The box's message, buttons and, when it may be dismissed from code, its abort signal.
   * @returns A promise of the chosen button's index, or the cancel button's when the box was dismissed.
   * @example
   * ```ts
   * import type { IDialogHost } from "@noldova/teamrun-shell-desktop";
   *
   * export async function askAsync(dialog: IDialogHost, windowId: number): Promise<boolean> {
   *   const { response } = await dialog.showMessageBox(windowId, { message: "Reload?", buttons: ["Reload", "Quit"], cancelId: 1 });
   *   return response === 0;
   * }
   * ```
   */
  showMessageBox(windowId: number, options: MessageBoxOptions): Promise<MessageBoxReturnValue>;
}

/**
 * Where the desktop records what a person or a support request may need to know.
 */
export interface IDesktopLog {
  /**
   * Records a line.
   *
   * @param text What happened.
   * @example
   * ```ts
   * import type { IDesktopLog } from "@noldova/teamrun-shell-desktop";
   *
   * export function record(log: IDesktopLog): void {
   *   log.write("The window's bounds could not be saved.");
   * }
   * ```
   */
  write(text: string): void;
}

/**
 * A native window, as Electron's `BrowserWindow` provides it.
 */
export interface IDesktopWindow {
  /**
   * The window's id, which a message box names as its parent.
   */
  readonly id: number;

  /**
   * The window's web contents.
   */
  readonly webContents: IWindowContents;

  /**
   * Loads a local page.
   *
   * @param filePath The page's file.
   * @returns A promise that settles when the page has loaded.
   * @example
   * ```ts
   * import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export async function loadAsync(window: IDesktopWindow): Promise<void> {
   *   await window.loadFile("/repository/_build/window/browser/index.html");
   * }
   * ```
   */
  loadFile(filePath: string): Promise<void>;

  /**
   * Sets the color shown behind the page.
   *
   * @param color A CSS color.
   * @example
   * ```ts
   * import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function darken(window: IDesktopWindow): void {
   *   window.setBackgroundColor("#181818");
   * }
   * ```
   */
  setBackgroundColor(color: string): void;

  /**
   * Sets the colors and height of the native window controls drawn over the page on Windows and Linux.
   *
   * @param options The overlay's colors and height.
   * @example
   * ```ts
   * import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function paintControls(window: IDesktopWindow): void {
   *   window.setTitleBarOverlay({ color: "#181818", symbolColor: "#CCCCCC", height: 35 });
   * }
   * ```
   */
  setTitleBarOverlay(options: TitleBarOverlayOptions): void;

  /**
   * Describes the window to the Windows taskbar: its app ID, its icon and the command that starts this build again.
   *
   * @param options The taskbar details.
   * @example
   * ```ts
   * import { type IDesktopWindow, TaskbarIdentity } from "@noldova/teamrun-shell-desktop";
   *
   * export function describe(window: IDesktopWindow): void {
   *   window.setAppDetails(TaskbarIdentity.create(true, "/opt/teamrun/teamrun", "", [], "/opt/teamrun").toAppDetails());
   * }
   * ```
   */
  setAppDetails(options: AppDetailsOptions): void;

  /**
   * The window's bounds when it is neither maximized nor minimized.
   *
   * @returns The bounds in screen pixels.
   * @example
   * ```ts
   * import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function widthOf(window: IDesktopWindow): number {
   *   return window.getNormalBounds().width;
   * }
   * ```
   */
  getNormalBounds(): Rectangle;

  /**
   * Moves or resizes the window.
   *
   * @param bounds The new position, size or both, in screen pixels.
   * @example
   * ```ts
   * import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function resize(window: IDesktopWindow): void {
   *   window.setBounds({ width: 1280, height: 800 });
   * }
   * ```
   */
  setBounds(bounds: Partial<Rectangle>): void;

  /**
   * Centers the window on its display.
   *
   * @example
   * ```ts
   * import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function centerOnDisplay(window: IDesktopWindow): void {
   *   window.center();
   * }
   * ```
   */
  center(): void;

  /**
   * Whether the window is maximized.
   *
   * @returns `true` when the window is maximized.
   * @example
   * ```ts
   * import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function isLarge(window: IDesktopWindow): boolean {
   *   return window.isMaximized();
   * }
   * ```
   */
  isMaximized(): boolean;

  /**
   * Maximizes the window.
   *
   * @example
   * ```ts
   * import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function enlarge(window: IDesktopWindow): void {
   *   window.maximize();
   * }
   * ```
   */
  maximize(): void;

  /**
   * Whether the window is shown.
   *
   * @returns `true` when the window is visible.
   * @example
   * ```ts
   * import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function showOnce(window: IDesktopWindow): void {
   *   if (!window.isVisible())
   *     window.show();
   * }
   * ```
   */
  isVisible(): boolean;

  /**
   * Whether the window has been destroyed.
   *
   * @returns `true` when the window is gone.
   * @example
   * ```ts
   * import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function closeIfOpen(window: IDesktopWindow): void {
   *   if (!window.isDestroyed())
   *     window.close();
   * }
   * ```
   */
  isDestroyed(): boolean;

  /**
   * Whether the window is minimized.
   *
   * @returns `true` when the window is minimized.
   * @example
   * ```ts
   * import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function bringBack(window: IDesktopWindow): void {
   *   if (window.isMinimized())
   *     window.restore();
   * }
   * ```
   */
  isMinimized(): boolean;

  /**
   * Whether the window has the keyboard focus.
   *
   * @returns `true` when the window is focused.
   * @example
   * ```ts
   * import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function isInUse(windows: readonly IDesktopWindow[]): boolean {
   *   return windows.some(t => t.isFocused());
   * }
   * ```
   */
  isFocused(): boolean;

  /**
   * Shows the window.
   *
   * @example
   * ```ts
   * import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function reveal(window: IDesktopWindow): void {
   *   window.show();
   * }
   * ```
   */
  show(): void;

  /**
   * Restores a minimized window.
   *
   * @example
   * ```ts
   * import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function unminimize(window: IDesktopWindow): void {
   *   window.restore();
   * }
   * ```
   */
  restore(): void;

  /**
   * Gives the window the keyboard focus.
   *
   * @example
   * ```ts
   * import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function bringForward(window: IDesktopWindow): void {
   *   window.focus();
   * }
   * ```
   */
  focus(): void;

  /**
   * Asks the window to close, which raises its `close` event first.
   *
   * @example
   * ```ts
   * import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function dismiss(window: IDesktopWindow): void {
   *   window.close();
   * }
   * ```
   */
  close(): void;

  /**
   * Listens for the window being asked to close, which the listener may cancel; for the window being resized, moved,
   * maximized or restored from maximized; or for its page no longer responding or responding again.
   *
   * @param event The event's name.
   * @param listener Receives the cancellable event when the window is asked to close; called with nothing otherwise.
   * @returns Electron's own return value, which the desktop does not use.
   * @example
   * ```ts
   * import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function keepOpen(window: IDesktopWindow): void {
   *   window.on("close", event => event.preventDefault());
   * }
   * ```
   */
  on(event: "close", listener: (event: IPreventableEvent) => void): unknown;
  on(event: "resize", listener: () => void): unknown;
  on(event: "move", listener: () => void): unknown;
  on(event: "will-move", listener: () => void): unknown;
  on(event: "will-resize", listener: () => void): unknown;
  on(event: "maximize", listener: () => void): unknown;
  on(event: "unmaximize", listener: () => void): unknown;
  on(event: "unresponsive", listener: () => void): unknown;
  on(event: "responsive", listener: () => void): unknown;

  /**
   * Listens once for the window having closed.
   *
   * @param event The event's name.
   * @param listener Called when the window is gone.
   * @returns Electron's own return value, which the desktop does not use.
   * @example
   * ```ts
   * import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function onGone(window: IDesktopWindow, gone: () => void): void {
   *   window.once("closed", gone);
   * }
   * ```
   */
  once(event: "closed", listener: () => void): unknown;
}

/**
 * The parent port of an Electron utility process, through which it answers the process that started it.
 */
export interface IParentPort {
  /**
   * Sends a message to the parent process.
   *
   * @param message A structured-cloneable value.
   * @example
   * ```ts
   * import type { IParentPort } from "@noldova/teamrun-shell-desktop";
   *
   * export function answer(port: IParentPort): void {
   *   port.postMessage({ processId: 4120, failure: null });
   * }
   * ```
   */
  postMessage(message: unknown): void;

  /**
   * Listens once for the parent process's next message.
   *
   * @param event The event's name.
   * @param listener Called when the message arrives.
   * @returns Electron's own return value, which the desktop does not use.
   * @example
   * ```ts
   * import type { IParentPort } from "@noldova/teamrun-shell-desktop";
   *
   * export function onAcknowledged(port: IParentPort, acknowledged: () => void): void {
   *   port.once("message", acknowledged);
   * }
   * ```
   */
  once(event: "message", listener: () => void): unknown;
}

/**
 * An Electron utility process, as the desktop uses one.
 */
export interface IUtilityProcess {
  /**
   * Sends a message to the utility process; messages wait until it is ready.
   *
   * @param message A structured-cloneable value.
   * @example
   * ```ts
   * import type { IUtilityProcess } from "@noldova/teamrun-shell-desktop";
   *
   * export function ask(child: IUtilityProcess): void {
   *   child.postMessage({ executable: "node", arguments: [], errorFile: "start.log", environment: {} });
   * }
   * ```
   */
  postMessage(message: unknown): void;

  /**
   * Listens once for the utility process's first message or its exit.
   *
   * @param event `message` or `exit`.
   * @param listener Receives the message, or the exit code.
   * @returns The utility process, for chaining.
   * @example
   * ```ts
   * import type { IUtilityProcess } from "@noldova/teamrun-shell-desktop";
   *
   * export function watch(child: IUtilityProcess, exits: unknown[]): void {
   *   child.once("exit", code => exits.push(code));
   * }
   * ```
   */
  once(event: "message" | "exit", listener: (value: unknown) => void): this;
}

/**
 * Electron's `utilityProcess`, as the desktop uses it.
 */
export interface IUtilityProcessHost {
  /**
   * Starts a utility process. Chromium's launcher gives it only the handles it lists, none of the desktop's other handles.
   *
   * @param modulePath The script the utility process runs.
   * @param args The script's arguments.
   * @param options The utility process's standard streams and the name it shows in task managers; it keeps the desktop's environment.
   * @returns The utility process.
   * @example
   * ```ts
   * import type { IUtilityProcess, IUtilityProcessHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function start(host: IUtilityProcessHost, script: string): IUtilityProcess {
   *   return host.fork(script, [], { stdio: "ignore", serviceName: "Example" });
   * }
   * ```
   */
  fork(modulePath: string, args: string[], options: { stdio: "ignore"; serviceName: string }): IUtilityProcess;
}

/**
 * The parts of Electron's main-process API the desktop uses, which the real modules satisfy and package tests replace
 * with fakes.
 */
export interface IElectron {
  /**
   * The application's lifecycle.
   */
  readonly app: IApplicationHost;

  /**
   * The main process's side of IPC.
   */
  readonly ipcMain: IIpcHost;

  /**
   * The sessions, for their permission handlers.
   */
  readonly session: ISessionHost;

  /**
   * The application menu.
   */
  readonly menu: IMenuHost;

  /**
   * The system clipboard, for copying text the window asks to copy.
   */
  readonly clipboard: IClipboardHost;

  /**
   * The system's file manager, for opening the log folder.
   */
  readonly shell: IShellHost;

  /**
   * Native message boxes, for a window whose page cannot draw.
   */
  readonly dialog: IDialogHost;

  /**
   * The operating system's notifications, for notifications posted while no window is focused.
   */
  readonly notifications: INotificationHost;

  /**
   * The displays, for placing a window on one that shows it.
   */
  readonly screen: IDisplayHost;

  /**
   * Creates a native window.
   *
   * @param options The window's options.
   * @returns The window.
   * @example
   * ```ts
   * import type { IDesktopWindow, IElectron } from "@noldova/teamrun-shell-desktop";
   *
   * export function openHidden(electron: IElectron): IDesktopWindow {
   *   return electron.createWindow({ width: 1280, height: 800, show: false });
   * }
   * ```
   */
  createWindow(options: BrowserWindowConstructorOptions): IDesktopWindow;
}

/**
 * The exception thrown when this device's identity file cannot be read or holds no valid identity.
 */
export declare class DeviceIdentityException extends Exception {
  /**
   * Creates the exception.
   *
   * @param message What is wrong with the file.
   * @param options The underlying error, if any.
   * @example
   * ```ts
   * import { DeviceIdentityException } from "@noldova/teamrun-shell-desktop";
   *
   * export const failure: DeviceIdentityException = new DeviceIdentityException("The device identity is not valid.");
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * This device's identity: a random id the desktop creates once and keeps outside the data directory, so state tied
 * to a device, such as window bounds, never travels with the data.
 */
export declare class DeviceIdentity {
  /**
   * The device-local folder that keeps the identity: `%LOCALAPPDATA%\Noldova\TeamRun` on Windows,
   * `~/Library/Application Support/Noldova/TeamRun` on macOS and `$XDG_STATE_HOME/noldova/teamrun` (by default
   * `~/.local/state/noldova/teamrun`) on Linux.
   *
   * @param platform The operating system, as Node.js names it.
   * @param environment The environment, which may set `LOCALAPPDATA` or `XDG_STATE_HOME`.
   * @param homeFolder The person's home folder.
   * @returns The folder.
   * @example
   * ```ts
   * import { DeviceIdentity } from "@noldova/teamrun-shell-desktop";
   *
   * export const folder: string = DeviceIdentity.locateFolder("linux", {}, "/home/person");
   * ```
   */
  public static locateFolder(platform: string, environment: NodeJS.ProcessEnv, homeFolder: string): string;

  /**
   * Reads the identity from the folder's `device.json`, creating the folder and a new identity when there is none.
   *
   * @param folder The folder that keeps the identity.
   * @returns A promise of the identity, a lowercase UUID.
   * @throws DeviceIdentityException as a rejection when the file cannot be read or holds no valid identity.
   * @example
   * ```ts
   * import { DeviceIdentity } from "@noldova/teamrun-shell-desktop";
   *
   * export const id: string = await DeviceIdentity.readOrCreateAsync("/home/person/.local/state/noldova/teamrun");
   * ```
   */
  public static readOrCreateAsync(folder: string): Promise<string>;
}

/**
 * Where the desktop finds the window and its preload, and which platform it runs on.
 */
export declare class DesktopSettings {
  /**
   * The operating system, as Node.js names it, such as `win32`, `darwin` or `linux`.
   */
  public readonly platform: string;

  /**
   * The built window's `index.html`.
   */
  public readonly windowIndexPath: string;

  /**
   * The compiled preload script the window runs before its page.
   */
  public readonly preloadPath: string;

  /**
   * Creates the settings.
   *
   * @param platform The operating system; not whitespace only.
   * @param windowIndexPath The built window's `index.html`; not whitespace only.
   * @param preloadPath The compiled preload script; not whitespace only.
   * @throws ArgumentException synchronously when a value is empty or whitespace only.
   * @example
   * ```ts
   * import { DesktopSettings } from "@noldova/teamrun-shell-desktop";
   *
   * export const settings: DesktopSettings = new DesktopSettings("linux", "/repository/_build/window/browser/index.html", "/repository/preload.cjs");
   * ```
   */
  public constructor(platform: string, windowIndexPath: string, preloadPath: string);

  /**
   * Locates the window and the preload relative to the installed desktop package.
   *
   * @param moduleDirectory The folder of the desktop's compiled entry point.
   * @param platform The operating system.
   * @returns The settings for a build run from the repository.
   * @example
   * ```ts
   * import { DesktopSettings } from "@noldova/teamrun-shell-desktop";
   *
   * export const settings: DesktopSettings = DesktopSettings.fromModule("/repository/node_modules/@noldova/teamrun-shell-desktop", "darwin");
   * ```
   */
  public static fromModule(moduleDirectory: string, platform: string): DesktopSettings;

  /**
   * The `file:` URL of the window's `index.html`, the only page the window may show.
   */
  public get windowUrl(): string;

  /**
   * Whether the platform is macOS.
   */
  public get isMac(): boolean;
}

/**
 * The work area of one display, in screen pixels.
 */
export declare class ScreenArea {
  /**
   * The left edge.
   */
  public readonly x: number;

  /**
   * The top edge.
   */
  public readonly y: number;

  /**
   * The width.
   */
  public readonly width: number;

  /**
   * The height.
   */
  public readonly height: number;

  /**
   * Creates the area.
   *
   * @param x The left edge.
   * @param y The top edge.
   * @param width The width.
   * @param height The height.
   * @example
   * ```ts
   * import { ScreenArea } from "@noldova/teamrun-shell-desktop";
   *
   * export const area: ScreenArea = new ScreenArea(0, 0, 1920, 1040);
   * ```
   */
  public constructor(x: number, y: number, width: number, height: number);

  /**
   * Tells whether a rectangle shares at least one pixel with the area.
   *
   * @param x The rectangle's left edge.
   * @param y The rectangle's top edge.
   * @param width The rectangle's width.
   * @param height The rectangle's height.
   * @returns `true` when the rectangle overlaps the area.
   * @example
   * ```ts
   * import { ScreenArea } from "@noldova/teamrun-shell-desktop";
   *
   * export const isVisible: boolean = new ScreenArea(0, 0, 1920, 1040).overlaps(1900, 100, 800, 600);
   * ```
   */
  public overlaps(x: number, y: number, width: number, height: number): boolean;
}

/**
 * The frame that sent an IPC message.
 */
export declare class SenderInfo {
  /**
   * The URL of the sending frame.
   */
  public readonly frameUrl: string;

  /**
   * Whether the frame is the window's main frame.
   */
  public readonly isTopLevel: boolean;

  /**
   * The id of the sending web contents.
   */
  public readonly contentsId: number;

  /**
   * Creates the description.
   *
   * @param frameUrl The URL of the sending frame.
   * @param isTopLevel Whether the frame is the main frame.
   * @param contentsId The id of the sending web contents.
   * @example
   * ```ts
   * import { SenderInfo } from "@noldova/teamrun-shell-desktop";
   *
   * export const sender: SenderInfo = new SenderInfo("file:///repository/_build/window/browser/index.html", true, 1);
   * ```
   */
  public constructor(frameUrl: string, isTopLevel: boolean, contentsId: number);
}

/**
 * Where starting the runtime stands, with what the window shows for it: the location of data from before the shell,
 * the descriptions of an older build's work, a newer build's version, or why the runtime could not start.
 */
export declare class StartupState {
  /**
   * Where starting stands.
   */
  public readonly kind: StartupStateKind;

  /**
   * What the window shows for it; empty for {@link StartupStateKind.Connecting} and {@link StartupStateKind.Ready}.
   */
  public readonly details: readonly string[];

  private constructor();

  /**
   * The state while starting or attaching.
   *
   * @returns The state.
   * @example
   * ```ts
   * import { StartupState } from "@noldova/teamrun-shell-desktop";
   *
   * export const state: StartupState = StartupState.connecting();
   * ```
   */
  public static connecting(): StartupState;

  /**
   * The state when data from before the shell must be moved aside first.
   *
   * @param location Where the data is.
   * @returns The state.
   * @example
   * ```ts
   * import { StartupState } from "@noldova/teamrun-shell-desktop";
   *
   * export const state: StartupState = StartupState.preShellData("/home/person/.noldova/teamrun");
   * ```
   */
  public static preShellData(location: string): StartupState;

  /**
   * The state when an older build's runtime has work in progress.
   *
   * @param descriptions The work.
   * @returns The state.
   * @example
   * ```ts
   * import { StartupState } from "@noldova/teamrun-shell-desktop";
   *
   * export const state: StartupState = StartupState.workInProgress(["A reply"]);
   * ```
   */
  public static workInProgress(descriptions: readonly string[]): StartupState;

  /**
   * The state while waiting for an older build's work.
   *
   * @param descriptions The work still in progress.
   * @returns The state.
   * @example
   * ```ts
   * import { StartupState } from "@noldova/teamrun-shell-desktop";
   *
   * export const state: StartupState = StartupState.waitingForWork(["A reply"]);
   * ```
   */
  public static waitingForWork(descriptions: readonly string[]): StartupState;

  /**
   * The state when a newer build's runtime owns the data directory and this build cannot start it.
   *
   * @param version The newer build's product version.
   * @returns The state.
   * @example
   * ```ts
   * import { StartupState } from "@noldova/teamrun-shell-desktop";
   *
   * export const state: StartupState = StartupState.newerBuild("2.0.0");
   * ```
   */
  public static newerBuild(version: string): StartupState;

  /**
   * The state when the runtime could not be started or reached.
   *
   * @param message Why.
   * @returns The state.
   * @example
   * ```ts
   * import { StartupState } from "@noldova/teamrun-shell-desktop";
   *
   * export const state: StartupState = StartupState.failed("The runtime did not start in time.");
   * ```
   */
  public static failed(message: string): StartupState;

  /**
   * The state once connected.
   *
   * @returns The state.
   * @example
   * ```ts
   * import { StartupState } from "@noldova/teamrun-shell-desktop";
   *
   * export const state: StartupState = StartupState.ready();
   * ```
   */
  public static ready(): StartupState;

  /**
   * Writes the state for the window.
   *
   * @returns The JSON form: `kind` and `details`.
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { StartupState } from "@noldova/teamrun-shell-desktop";
   *
   * export const json: JsonObject = StartupState.failed("The runtime did not start in time.").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The colors and title-bar height the window painted, which the desktop gives its native title bar
 * before it shows the window.
 */
export declare class WindowAppearance {
  /**
   * The window's background color.
   */
  public readonly background: string;

  /**
   * The title bar's color.
   */
  public readonly titleBar: string;

  /**
   * The title bar's text and symbol color.
   */
  public readonly titleBarText: string;

  /**
   * The title bar's height in device-independent pixels.
   */
  public readonly titleBarHeight: number;

  /**
   * Creates the appearance.
   *
   * @param background A hexadecimal, `rgb()` or `rgba()` color.
   * @param titleBar A hexadecimal, `rgb()` or `rgba()` color.
   * @param titleBarText A hexadecimal, `rgb()` or `rgba()` color.
   * @param titleBarHeight A positive whole number of pixels.
   * @throws ArgumentException synchronously for a color in another form.
   * @throws ArgumentOutOfRangeException synchronously for a height that is not a positive integer.
   * @example
   * ```ts
   * import { WindowAppearance } from "@noldova/teamrun-shell-desktop";
   *
   * export const appearance: WindowAppearance = new WindowAppearance("#181818", "#181818", "#CCCCCC", 35);
   * ```
   */
  public constructor(background: string, titleBar: string, titleBarText: string, titleBarHeight: number);

  /**
   * Reads an appearance received from the window.
   *
   * @param value The untrusted message payload.
   * @returns The appearance.
   * @throws JsonException synchronously when the payload is not an appearance, naming the field.
   * @example
   * ```ts
   * import { WindowAppearance } from "@noldova/teamrun-shell-desktop";
   *
   * export const appearance: WindowAppearance = WindowAppearance.fromJson({ background: "#F8F8F8", titleBar: "#F8F8F8", titleBarText: "#1E1E1E", titleBarHeight: 35 });
   * ```
   */
  public static fromJson(value: unknown): WindowAppearance;

  /**
   * Writes the appearance as the window sends it.
   *
   * @returns The appearance as JSON.
   * @example
   * ```ts
   * import { WindowAppearance } from "@noldova/teamrun-shell-desktop";
   *
   * export const message: string = JSON.stringify(new WindowAppearance("#181818", "#181818", "#CCCCCC", 35).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A window's place and size on the screen, as the desktop saves and restores it.
 */
export declare class WindowState {
  /**
   * The left edge in screen pixels, or `null` to let the operating system place the window.
   */
  public readonly x: number | null;

  /**
   * The top edge in screen pixels, or `null` to let the operating system place the window.
   */
  public readonly y: number | null;

  /**
   * The width in pixels.
   */
  public readonly width: number;

  /**
   * The height in pixels.
   */
  public readonly height: number;

  /**
   * Whether the window is maximized; the other values then describe its normal bounds.
   */
  public readonly isMaximized: boolean;

  /**
   * Creates the state.
   *
   * @param x The left edge, an integer, or `null` together with `y`.
   * @param y The top edge, an integer, or `null` together with `x`.
   * @param width The width; an integer of at least the window's minimum width, 640.
   * @param height The height; an integer of at least the window's minimum height, 400.
   * @param isMaximized Whether the window is maximized.
   * @throws ArgumentException synchronously when only one coordinate is given.
   * @throws ArgumentOutOfRangeException synchronously for a coordinate that is not an integer or a size below the
   * minimum.
   * @example
   * ```ts
   * import { WindowState } from "@noldova/teamrun-shell-desktop";
   *
   * export const state: WindowState = new WindowState(100, 80, 1280, 800, false);
   * ```
   */
  public constructor(x: number | null, y: number | null, width: number, height: number, isMaximized: boolean);

  /**
   * The state of a window that has not been placed yet: 1280 by 800 pixels where the operating system puts it.
   *
   * @returns The default state.
   * @example
   * ```ts
   * import { WindowState } from "@noldova/teamrun-shell-desktop";
   *
   * export const state: WindowState = WindowState.createDefault();
   * ```
   */
  public static createDefault(): WindowState;

  /**
   * Reads a saved state.
   *
   * @param value The saved JSON.
   * @returns The state.
   * @throws JsonException synchronously when the value is not a valid state, naming the field.
   * @example
   * ```ts
   * import { WindowState } from "@noldova/teamrun-shell-desktop";
   *
   * export const state: WindowState = WindowState.fromJson({ x: null, y: null, width: 1280, height: 800, maximized: true });
   * ```
   */
  public static fromJson(value: unknown): WindowState;

  /**
   * Keeps the saved position when the window would show on one of the displays, and otherwise lets the operating
   * system place it, keeping its size.
   *
   * @param workAreas The work areas of the connected displays.
   * @returns This state, or the same size without a position.
   * @example
   * ```ts
   * import { ScreenArea, WindowState } from "@noldova/teamrun-shell-desktop";
   *
   * export const state: WindowState = new WindowState(3000, 100, 1280, 800, false).placeOn([new ScreenArea(0, 0, 1920, 1040)]);
   * ```
   */
  public placeOn(workAreas: readonly ScreenArea[]): WindowState;

  /**
   * Writes the state for saving.
   *
   * @returns The state as JSON.
   * @example
   * ```ts
   * import { WindowState } from "@noldova/teamrun-shell-desktop";
   *
   * export const saved: string = JSON.stringify(WindowState.createDefault().toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Asks one window to save before it closes, and decides whether it may close: a window that reports a failed save
 * stays open, while a window that is gone or does not answer in time does not block closing.
 */
export declare class CloseCoordinator {
  /**
   * Creates the coordinator.
   *
   * @param send Sends a close request with its id to the window; returns `false` when the window is gone.
   * @param timeout How long to wait for an answer, in milliseconds; a positive integer.
   * @throws ArgumentOutOfRangeException synchronously when the timeout is not a positive integer.
   * @example
   * ```ts
   * import { CloseCoordinator } from "@noldova/teamrun-shell-desktop";
   *
   * export const coordinator: CloseCoordinator = new CloseCoordinator(() => true, 5000);
   * ```
   */
  public constructor(send: (requestId: string) => boolean, timeout: number);

  /**
   * Asks the window to save.
   *
   * @returns A promise of `true` when the window may close: it saved, it is gone or it did not answer in time; `false`
   * when it reported a failed save.
   * @example
   * ```ts
   * import { CloseCoordinator } from "@noldova/teamrun-shell-desktop";
   *
   * const coordinator = new CloseCoordinator(t => coordinator.answer(t, true), 5000);
   * export const canClose: boolean = await coordinator.requestAsync();
   * ```
   */
  public requestAsync(): Promise<boolean>;

  /**
   * Takes the window's answer to a request.
   *
   * @param requestId The request's id, as the window sent it.
   * @param isSaved Whether the window saved.
   * @returns `true` when the answer settled a waiting request; `false` for an unknown or late id or a malformed answer.
   * @example
   * ```ts
   * import { CloseCoordinator } from "@noldova/teamrun-shell-desktop";
   *
   * export const isAccepted: boolean = new CloseCoordinator(() => true, 5000).answer("unknown", true);
   * ```
   */
  public answer(requestId: unknown, isSaved: unknown): boolean;

  /**
   * Lets every waiting request close, as when the window is gone.
   *
   * @example
   * ```ts
   * import { CloseCoordinator } from "@noldova/teamrun-shell-desktop";
   *
   * new CloseCoordinator(() => true, 5000).release();
   * ```
   */
  public release(): void;
}

/**
 * One open window: it shows once its page has painted and its startup has settled, or unpainted after a limit; asks
 * its guard whether it may close, then its page to save; and keeps its bounds.
 */
export declare class OpenWindow implements IQuitPrompt {
  /**
   * The native window.
   */
  public readonly window: IDesktopWindow;

  /**
   * Asks the page to save before the window closes.
   */
  public readonly coordinator: CloseCoordinator;

  /**
   * Restores and keeps the window's bounds.
   */
  public readonly bounds: WindowBoundsKeeper;

  /**
   * Takes charge of a window that is not yet shown.
   *
   * @param window The window, created hidden.
   * @param displays The displays, for placing restored bounds.
   * @param log Records why a window was shown unpainted and saves that failed.
   * @param guard Decides whether closing the window may go ahead while work is in progress, and stops the work when
   * the person chose to.
   * @param platform The operating system's name, as Node reports it.
   * @example
   * ```ts
   * import { type ICloseGuard, type IDesktopLog, type IDesktopWindow, type IDisplayHost, OpenWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function track(window: IDesktopWindow, displays: IDisplayHost, log: IDesktopLog, guard: ICloseGuard): OpenWindow {
   *   return new OpenWindow(window, displays, log, guard, "win32");
   * }
   * ```
   */
  public constructor(window: IDesktopWindow, displays: IDisplayHost, log: IDesktopLog, guard: ICloseGuard, platform: string);

  /**
   * Shows the page the question about work in progress, or takes it away.
   *
   * @param question The question, or `null` to take it away.
   * @returns Whether the page can show it: false when the window is gone or its page has crashed.
   * @example
   * ```ts
   * import { type OpenWindow, QuitQuestion } from "@noldova/teamrun-shell-desktop";
   *
   * export function ask(open: OpenWindow): boolean {
   *   return open.show(new QuitQuestion(["Indexing the project"], false));
   * }
   * ```
   */
  public show(question: QuitQuestion | null): boolean;

  /**
   * Notes that the page has painted, and shows the window if its startup has settled.
   *
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function painted(open: OpenWindow): void {
   *   open.markPainted();
   * }
   * ```
   */
  public markPainted(): void;

  /**
   * Settles the startup after a delay, whatever the runtime does by then.
   *
   * @param milliseconds The delay.
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function settleSoon(open: OpenWindow): void {
   *   open.settleWithin(2_000);
   * }
   * ```
   */
  public settleWithin(milliseconds: number): void;

  /**
   * Notes that the startup has settled, and shows the window if its page has painted.
   *
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function settled(open: OpenWindow): void {
   *   open.settle();
   * }
   * ```
   */
  public settle(): void;

  /**
   * Shows the window after a limit even when its page has not painted by then, settling its startup, and records why:
   * the page is still loading, has crashed, or loaded without reporting its paint.
   *
   * @param milliseconds The limit.
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function showWithin(open: OpenWindow): void {
   *   open.showUnpaintedWithin(10_000);
   * }
   * ```
   */
  public showUnpaintedWithin(milliseconds: number): void;

  /**
   * Shows the window now, painted or not, settling its startup.
   *
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function showAtOnce(open: OpenWindow): void {
   *   open.showNow();
   * }
   * ```
   */
  public showNow(): void;
}

/**
 * Keeps a window usable when its page's renderer process is gone or stops responding. It records each episode, its
 * outcome and the person's choice in the desktop log, and asks with a native message box, because the page cannot draw:
 * a gone page offers Reload or Quit, or the log folder and Quit when it went again soon after a reload, so a page that
 * fails while loading never becomes a loop; a page that stops responding offers Wait or Reload once per episode, and the
 * box closes when the page responds again. Reload ends the page's renderer and reloads once it has gone; a renderer that
 * has not gone within a limit has its process ended, and a page with no renderer process of its own to end, or whose
 * process cannot be ended, is reloaded at once.
 */
export declare class WindowRecovery {
  /**
   * Starts watching a window.
   *
   * @param open The window.
   * @param dialog Shows the message boxes.
   * @param log Records each episode, its outcome and the person's choice.
   * @param process Ends a renderer process that did not stop when asked.
   * @param quit Quits the application.
   * @param openLogFolderAsync Opens the log folder; its promise tells whether it opened.
   * @param reloadCrashLimit How soon after a reload a page that goes again is offered the log folder instead, in
   * milliseconds.
   * @param rendererEndLimit How long a renderer asked to stop may take before its process is ended, in milliseconds.
   * @example
   * ```ts
   * import { type IDesktopLog, type IDesktopProcess, type IDialogHost, type OpenWindow, WindowRecovery } from "@noldova/teamrun-shell-desktop";
   *
   * export function recover(open: OpenWindow, dialog: IDialogHost, log: IDesktopLog, desktop: IDesktopProcess): WindowRecovery {
   *   return new WindowRecovery(open, dialog, log, desktop, () => process.exit(0), () => Promise.resolve(true), 10_000, 5_000);
   * }
   * ```
   */
  public constructor(
    open: OpenWindow,
    dialog: IDialogHost,
    log: IDesktopLog,
    process: IDesktopProcess,
    quit: () => void,
    openLogFolderAsync: () => Promise<boolean>,
    reloadCrashLimit: number,
    rendererEndLimit: number);
}

/**
 * The desktop's main process: one sandboxed instance with one window, which it shows once the page has painted its
 * theme, or unpainted after ten seconds, and closes once the page has saved. It records its diagnostics in
 * `logs/desktop.log` once the data directory is usable, and on standard error.
 */
export declare class DesktopApplication {
  private constructor();

  /**
   * Starts the desktop: chooses the data directory and keeps Electron's profile in its `desktop` folder (unless
   * `--user-data-dir=` gives one), claims the single-instance lock, then opens the window when Electron is ready and
   * starts or attaches to the runtime, which runs from the desktop's program in Node mode.
   *
   * @param electron Electron's main-process API.
   * @param process The desktop's process; `--data-dir=` in its arguments gives the data directory.
   * @param moduleUrl The URL of the desktop's compiled entry point, which locates the window, the preload and, in a
   * development run, the checkout.
   * @param createLauncher Creates the runtime launcher for the chosen settings.
   * @param readDeviceAsync Reads this device's identity from a folder: the one `--device-dir=` in the process's
   * arguments gives, otherwise the operating system's local application data. A failure leaves window bounds unkept.
   * @param createAppearanceStore Creates the store of this device's last appearance preferences in the same folder. The
   * desktop reads them before it opens a window, so the window's first frame already has them, and keeps those the
   * window reports.
   * @example
   * ```ts
   * import { RuntimeBuild, RuntimeLauncher } from "@noldova/teamrun-shell-runtime";
   * import { AppearanceStore, DesktopApplication, DeviceIdentity, type IDesktopProcess, type IElectron } from "@noldova/teamrun-shell-desktop";
   *
   * export function launch(electron: IElectron, process: IDesktopProcess): void {
   *   DesktopApplication.start(
   *     electron,
   *     process,
   *     "file:///repository/node_modules/@noldova/teamrun-shell-desktop/main.js",
   *     t => new RuntimeLauncher(t, RuntimeBuild.identity),
   *     t => DeviceIdentity.readOrCreateAsync(t),
   *     t => new AppearanceStore(t));
   * }
   * ```
   */
  public static start(
    electron: IElectron,
    process: IDesktopProcess,
    moduleUrl: string,
    createLauncher: (settings: LaunchSettings) => IRuntimeLauncher,
    readDeviceAsync: (folder: string) => Promise<string>,
    createAppearanceStore: (folder: string) => IAppearanceStore): void;
}

/**
 * Where the desktop keeps this device's last appearance preferences, outside the data directory, so the next start
 * paints its first frame with them.
 */
export interface IAppearanceStore {
  /**
   * Reads the preferences kept last.
   *
   * @returns A promise of the preferences, or `null` when none are kept; it rejects when the kept file cannot be read.
   * @example
   * ```ts
   * import type { IAppearanceStore } from "@noldova/teamrun-shell-desktop";
   *
   * export async function hasAppearanceAsync(store: IAppearanceStore): Promise<boolean> {
   *   return await store.readAsync() !== null;
   * }
   * ```
   */
  readAsync(): Promise<JsonObject | null>;

  /**
   * Keeps the preferences, replacing those kept before; writes happen one at a time, in order.
   *
   * @param preferences The appearance preferences the window reported.
   * @returns A promise that settles once they are kept.
   * @example
   * ```ts
   * import type { IAppearanceStore } from "@noldova/teamrun-shell-desktop";
   *
   * export function keepDarkAsync(store: IAppearanceStore): Promise<void> {
   *   return store.writeAsync({ "shell.mode": "Dark" });
   * }
   * ```
   */
  writeAsync(preferences: JsonObject): Promise<void>;
}

/**
 * Keeps the appearance preferences in `appearance.json` in a device folder, writing a temporary file and renaming it so
 * an interrupted write never leaves a partial file.
 */
export declare class AppearanceStore implements IAppearanceStore {
  /**
   * Creates the store.
   *
   * @param folder The device folder.
   * @example
   * ```ts
   * import { AppearanceStore } from "@noldova/teamrun-shell-desktop";
   *
   * export const store: AppearanceStore = new AppearanceStore("/home/person/.local/state/noldova/teamrun");
   * ```
   */
  public constructor(folder: string);

  /**
   * Reads the preferences kept last.
   *
   * @returns A promise of the preferences, or `null` when the file does not exist.
   * @throws {SyntaxError} Asynchronously when the file is not JSON.
   * @throws {JsonException} Asynchronously when the file holds JSON that is not an object.
   * @example
   * ```ts
   * import { AppearanceStore } from "@noldova/teamrun-shell-desktop";
   *
   * export function readAsync(folder: string): Promise<unknown> {
   *   return new AppearanceStore(folder).readAsync();
   * }
   * ```
   */
  public readAsync(): Promise<JsonObject | null>;

  /**
   * Keeps the preferences, after any write still in progress, creating the folder when needed.
   *
   * @param preferences The appearance preferences.
   * @returns A promise that settles once they are kept, and rejects when they could not be written.
   * @example
   * ```ts
   * import { AppearanceStore } from "@noldova/teamrun-shell-desktop";
   *
   * export function keepAsync(folder: string): Promise<void> {
   *   return new AppearanceStore(folder).writeAsync({ "shell.mode": "Light" });
   * }
   * ```
   */
  public writeAsync(preferences: JsonObject): Promise<void>;
}

/**
 * Starts or attaches to the runtime and turns each refusal into a {@link StartupState} the window shows, then carries
 * out the person's choice: move data from before the shell aside, wait for or stop an older build's work, or try again.
 */
export declare class RuntimeStartup {
  /**
   * Creates the startup.
   *
   * @param launcher Starts or attaches to the runtime.
   * @param publish Receives each new state.
   * @param handOver Hands the person over to a newer build; returns `false` when this build cannot, so the window
   * shows {@link StartupStateKind.NewerBuild}.
   * @param waitInterval How long to pause between attempts while waiting for an older build's work, in milliseconds.
   * @param forward Receives each event the runtime sends on the current connection.
   * @param log Receives each launch or connection failure, and the full description of any other failure.
   * @example
   * ```ts
   * import { type IRuntimeLauncher, RuntimeStartup } from "@noldova/teamrun-shell-desktop";
   *
   * export function create(launcher: IRuntimeLauncher): RuntimeStartup {
   *   return new RuntimeStartup(
   *     launcher, state => console.log(state.kind), () => false, 2000, event => console.log(event.name.text), message => console.error(message));
   * }
   * ```
   */
  public constructor(
    launcher: IRuntimeLauncher,
    publish: (state: StartupState) => void,
    handOver: (handover: RuntimeHandover) => boolean,
    waitInterval: number,
    forward: (event: Event) => void,
    log: (message: string) => void);

  /**
   * The latest state.
   */
  public get current(): StartupState;

  /**
   * The connection to the runtime while the state is {@link StartupStateKind.Ready}; otherwise `null`.
   */
  public get connection(): IRuntimeConnection | null;

  /**
   * Starts or attaches to the runtime, stopping an older build's runtime only when it is idle. Reconnects when the
   * runtime disconnects until {@link close}. A start or reconnection that fails for any reason other than data from
   * before the shell, an older build's work or a newer build is logged, an unexpected failure in full, and shows
   * the failure with an offer to try again.
   *
   * @returns A promise that settles once the state is ready or shows why not.
   * @example
   * ```ts
   * import type { RuntimeStartup } from "@noldova/teamrun-shell-desktop";
   *
   * export async function startAsync(startup: RuntimeStartup): Promise<void> {
   *   await startup.startAsync();
   * }
   * ```
   */
  public startAsync(): Promise<void>;

  /**
   * Carries out the person's choice when it fits the current state: `moveAside` for data from before the shell,
   * `stopWork` or `wait` for an older build's work, and `retry` after a failure.
   *
   * @param action The choice, as the window sends it.
   * @returns A promise of `true` once the choice is carried out, or `false` when it does not fit the state.
   * @example
   * ```ts
   * import type { RuntimeStartup } from "@noldova/teamrun-shell-desktop";
   *
   * export function moveAsideAsync(startup: RuntimeStartup): Promise<boolean> {
   *   return startup.actAsync("moveAside");
   * }
   * ```
   */
  public actAsync(action: unknown): Promise<boolean>;

  /**
   * Closes the connection and stops reconnecting and waiting.
   *
   * @example
   * ```ts
   * import type { RuntimeStartup } from "@noldova/teamrun-shell-desktop";
   *
   * export function quit(startup: RuntimeStartup): void {
   *   startup.close();
   * }
   * ```
   */
  public close(): void;
}

/**
 * Decides which frames may use the bridge: only the main frame of the window's own page.
 */
export declare class SenderPolicy {
  /**
   * Creates the policy.
   *
   * @param windowUrl The `file:` URL of the window's page; not whitespace only.
   * @throws ArgumentException synchronously when the URL is empty or whitespace only.
   * @example
   * ```ts
   * import { SenderPolicy } from "@noldova/teamrun-shell-desktop";
   *
   * export const policy: SenderPolicy = new SenderPolicy("file:///repository/_build/window/browser/index.html");
   * ```
   */
  public constructor(windowUrl: string);

  /**
   * Tells whether a sender is the window's own main frame.
   *
   * @param sender The frame that sent a message.
   * @returns `true` for the main frame showing the window's page.
   * @example
   * ```ts
   * import { SenderInfo, SenderPolicy } from "@noldova/teamrun-shell-desktop";
   *
   * const url = "file:///repository/_build/window/browser/index.html";
   * export const isTrusted: boolean = new SenderPolicy(url).isTrusted(new SenderInfo(`${url}#settings`, true, 1));
   * ```
   */
  public isTrusted(sender: SenderInfo): boolean;

  /**
   * Tells whether a URL is the window's page, with or without a fragment or query.
   *
   * @param url The URL to check, such as a navigation target.
   * @returns `true` for the window's page.
   * @example
   * ```ts
   * import { SenderPolicy } from "@noldova/teamrun-shell-desktop";
   *
   * export const isWindow: boolean = new SenderPolicy("file:///repository/_build/window/browser/index.html").isWindowUrl("https://example.com/");
   * ```
   */
  public isWindowUrl(url: string): boolean;
}

/**
 * Shows new notifications through the operating system while no TeamRun window is focused. A notification is new when
 * its sequence is above every one seen since the window last read the notifications, so it counts from the same point
 * as the window's toasts; while a window loads, broadcasts wait for its read. Updates, work in progress, notifications
 * from a muted module and those posted while Do not disturb is on for the device never show. An operating system notification closes
 * when its notification is dismissed or replaced, and a failure to show one is logged once.
 */
export declare class SystemNotifier {
  /**
   * Creates the notifier.
   *
   * @param host The operating system's notification service.
   * @param log Where the first failure to show a notification is written.
   * @param readIcon Gives the application icon's path for each notification.
   * @param isAnyWindowFocused Tells whether a TeamRun window has the focus.
   * @param open Brings TeamRun forward and opens a clicked notification, by its id.
   * @example
   * ```ts
   * import type { IDesktopLog, INotificationHost } from "@noldova/teamrun-shell-desktop";
   * import { SystemNotifier } from "@noldova/teamrun-shell-desktop";
   *
   * export function create(host: INotificationHost, log: IDesktopLog): SystemNotifier {
   *   return new SystemNotifier(host, log, () => "/teamrun/icon.png", () => false, t => console.log(t));
   * }
   * ```
   */
  public constructor(host: INotificationHost, log: IDesktopLog, readIcon: () => string, isAnyWindowFocused: () => boolean, open: (id: number) => void);

  /**
   * The number to pass to {@link begin} for a read starting now; a reset or a hold changes it, so a read started before
   * them is ignored.
   */
  public get epoch(): number;

  /**
   * Forgets the runtime's notifications and closes those shown, when the runtime connection ends or starts again.
   *
   * @example
   * ```ts
   * import type { SystemNotifier } from "@noldova/teamrun-shell-desktop";
   *
   * export function disconnect(notifier: SystemNotifier): void {
   *   notifier.reset();
   * }
   * ```
   */
  public reset(): void;

  /**
   * Holds broadcasts while a window loads, until its read of the notifications answers.
   *
   * @example
   * ```ts
   * import type { SystemNotifier } from "@noldova/teamrun-shell-desktop";
   *
   * export function reload(notifier: SystemNotifier): void {
   *   notifier.hold();
   * }
   * ```
   */
  public hold(): void;

  /**
   * Shows notifications above the sequence a window's read returned, including any in a broadcast held since.
   *
   * @param epoch The {@link epoch} when the read started.
   * @param device This device's id, to know when its Do not disturb is on.
   * @param sequence The sequence the read returned.
   * @example
   * ```ts
   * import type { SystemNotifier } from "@noldova/teamrun-shell-desktop";
   *
   * export function connect(notifier: SystemNotifier, device: string): void {
   *   notifier.begin(notifier.epoch, device, 0);
   * }
   * ```
   */
  public begin(epoch: number, device: string, sequence: number): void;

  /**
   * Follows a broadcast of the runtime's notifications.
   *
   * @param broadcast The notifications, the quiet devices and the latest sequence.
   * @example
   * ```ts
   * import type { SystemNotifier } from "@noldova/teamrun-shell-desktop";
   * import { NotificationBroadcast } from "@noldova/teamrun-shell-protocol";
   *
   * export function clear(notifier: SystemNotifier): void {
   *   notifier.receive(new NotificationBroadcast([], [], [], 0));
   * }
   * ```
   */
  public receive(broadcast: NotificationBroadcast): void;
}

/**
 * The exception thrown when a window's state cannot be read or kept through the runtime.
 */
export declare class WindowStateException extends Exception {
  /**
   * Creates the exception.
   *
   * @param message What went wrong.
   * @param options The underlying error, if any.
   * @example
   * ```ts
   * import { WindowStateException } from "@noldova/teamrun-shell-desktop";
   *
   * export const failure: WindowStateException = new WindowStateException("TeamRun is not connected to its runtime.");
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a window's state cannot be read or kept because the runtime cannot be reached: the desktop
 * has no connection, or the connection failed. A refusal from the runtime is a {@link WindowStateException} instead.
 */
export declare class WindowStateUnavailableException extends WindowStateException {
  /**
   * Creates the exception.
   *
   * @param message What went wrong.
   * @param options The connection's failure, if any.
   * @example
   * ```ts
   * import { WindowStateUnavailableException } from "@noldova/teamrun-shell-desktop";
   *
   * export const failure: WindowStateUnavailableException = new WindowStateUnavailableException("TeamRun is not connected to its runtime.");
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * Keeps one window's state, its bounds or its layout, in the shell's database through the runtime.
 */
export declare class RuntimeWindowStateStore implements IWindowStateStore {
  /**
   * Creates the store.
   *
   * @param connection Returns the current connection to the runtime, or `null` while there is none.
   * @param key The device and window the state belongs to.
   * @param readMethod The method that reads the state, such as `ShellMethods.readWindowBounds`.
   * @param writeMethod The method that keeps the state, such as `ShellMethods.writeWindowBounds`.
   * @example
   * ```ts
   * import { ShellMethods, WindowStateKey } from "@noldova/teamrun-shell-protocol";
   * import { type RuntimeStartup, RuntimeWindowStateStore } from "@noldova/teamrun-shell-desktop";
   *
   * export function boundsOf(startup: RuntimeStartup, device: string): RuntimeWindowStateStore {
   *   return new RuntimeWindowStateStore(() => startup.connection, new WindowStateKey(device, "main"), ShellMethods.readWindowBounds, ShellMethods.writeWindowBounds);
   * }
   * ```
   */
  public constructor(connection: () => IRuntimeConnection | null, key: WindowStateKey, readMethod: QualifiedName, writeMethod: QualifiedName);

  /**
   * Reads the kept state.
   *
   * @returns A promise of the state, or `null` when none is kept.
   * @throws WindowStateUnavailableException as a rejection when the runtime cannot be reached.
   * @throws WindowStateException as a rejection when the runtime refuses.
   * @throws JsonException as a rejection when the runtime's answer is not a window state.
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import type { RuntimeWindowStateStore } from "@noldova/teamrun-shell-desktop";
   *
   * export function readAsync(store: RuntimeWindowStateStore): Promise<JsonObject | null> {
   *   return store.readAsync();
   * }
   * ```
   */
  public readAsync(): Promise<JsonObject | null>;

  /**
   * Keeps a new state.
   *
   * @param value The state.
   * @returns A promise that settles once the runtime kept it.
   * @throws WindowStateUnavailableException as a rejection when the runtime cannot be reached.
   * @throws WindowStateException as a rejection when the runtime refuses.
   * @example
   * ```ts
   * import type { RuntimeWindowStateStore } from "@noldova/teamrun-shell-desktop";
   *
   * export function keepAsync(store: RuntimeWindowStateStore): Promise<void> {
   *   return store.writeAsync({ x: 100, y: 80, width: 1280, height: 800, maximized: false });
   * }
   * ```
   */
  public writeAsync(value: JsonObject): Promise<void>;
}

/**
 * The desktop's log, `logs/desktop.log` in the data directory, mirrored to standard error. One desktop runs per data
 * directory, so the desktop alone owns the file. It stays within its size limit by becoming `logs/desktop.previous.log`
 * when it fills.
 */
export declare class DesktopLog implements IDesktopLog {
  /**
   * Creates the log; nothing is written to the file until it opens.
   *
   * @param directory The data directory whose `logs/desktop.log` the desktop owns.
   * @param error Standard error, which receives every line, also before the file opens and when it cannot be written.
   * @param redactor Removes the home folder and opaque values from every line.
   * @param now The clock that stamps each line; the current time by default.
   * @example
   * ```ts
   * import { homedir } from "node:os";
   *
   * import { DesktopLog } from "@noldova/teamrun-shell-desktop";
   * import { DiagnosticRedactor, type DataDirectory } from "@noldova/teamrun-shell-runtime";
   *
   * export function createLog(directory: DataDirectory): DesktopLog {
   *   return new DesktopLog(directory, process.stderr, new DiagnosticRedactor(homedir()));
   * }
   * ```
   */
  public constructor(directory: DataDirectory, error: Writable, redactor: DiagnosticRedactor, now?: () => Date);

  /**
   * Starts the file once the data directory is usable: keeps the previous start's log as `logs/desktop.previous.log`
   * and starts `logs/desktop.log`. Only the first call does anything. When the file cannot be started, the log
   * records why and goes on writing to standard error only.
   *
   * @example
   * ```ts
   * import type { DesktopLog } from "@noldova/teamrun-shell-desktop";
   *
   * export function start(log: DesktopLog): void {
   *   log.open();
   * }
   * ```
   */
  public open(): void;

  /**
   * Records a line, stamped with the time and redacted, on standard error and, once open, in the file. When the file
   * cannot take a line, later lines go to standard error only, and the log records why there.
   *
   * @param text What happened.
   * @example
   * ```ts
   * import type { DesktopLog } from "@noldova/teamrun-shell-desktop";
   *
   * export function record(log: DesktopLog): void {
   *   log.write("The window was shown before it was painted.");
   * }
   * ```
   */
  public write(text: string): void;
}

/**
 * Restores a window's saved bounds onto the displays that show it, then keeps them after each pause in moving,
 * resizing and maximizing, and on request before the window closes.
 */
export declare class WindowBoundsKeeper {
  /**
   * Creates the keeper and listens for the window's changes, which it saves once it has a store. A move or resize the
   * person makes before then is held where the window reports only the person's own as "will-move" and "will-resize", which
   * is Windows; on macOS the system's own moves report as "will-move" too, and Linux reports neither, so nothing is held there.
   *
   * @param window The window.
   * @param displays The displays, for placing restored bounds.
   * @param saveDelay How long a pause in changes lasts before the bounds are saved, in milliseconds.
   * @param log Records a save that failed.
   * @param holdsPersonsMoves Whether the window's "will-move" and "will-resize" come only from the person.
   * @example
   * ```ts
   * import { type IDesktopLog, type IDesktopWindow, type IDisplayHost, WindowBoundsKeeper } from "@noldova/teamrun-shell-desktop";
   *
   * export function keep(window: IDesktopWindow, displays: IDisplayHost, log: IDesktopLog): WindowBoundsKeeper {
   *   return new WindowBoundsKeeper(window, displays, 500, log, true);
   * }
   * ```
   */
  public constructor(window: IDesktopWindow, displays: IDisplayHost, saveDelay: number, log: IDesktopLog, holdsPersonsMoves: boolean);

  /**
   * Keeps the bounds in the store from now on, and applies the bounds it holds: the saved position when a display
   * shows it, otherwise the saved size centered, then maximized when it was. When the person already moved or
   * resized the window, those bounds stay and are saved instead of the saved ones being applied.
   *
   * @param store Where the bounds are kept.
   * @returns A promise that settles once the saved bounds are applied, or at once when none are saved.
   * @throws JsonException as a rejection when the saved bounds are not a window state; the window keeps its bounds.
   * @throws The store's failure as a rejection when it could not keep the bounds the person set; they stay unsaved.
   * @example
   * ```ts
   * import type { IWindowStateStore, WindowBoundsKeeper } from "@noldova/teamrun-shell-desktop";
   *
   * export function restoreAsync(keeper: WindowBoundsKeeper, store: IWindowStateStore): Promise<void> {
   *   return keeper.restoreAsync(store);
   * }
   * ```
   */
  public restoreAsync(store: IWindowStateStore): Promise<void>;

  /**
   * Saves the window's current bounds at once, cancelling a pending save; does nothing after the window is gone, or
   * before a store is set unless the person moved or resized the window. Bounds that could not be kept stay unsaved for
   * {@link WindowBoundsKeeper.saveUnsavedAsync}.
   * A save after a move or resize that finds the runtime unreachable keeps the bounds unsaved without reporting it.
   *
   * @returns A promise that settles once the bounds are kept.
   * @throws The store's failure as a rejection.
   * @throws {WindowStateUnavailableException} Asynchronously when the person moved or resized the window before a store was set.
   * @example
   * ```ts
   * import type { WindowBoundsKeeper } from "@noldova/teamrun-shell-desktop";
   *
   * export function saveAsync(keeper: WindowBoundsKeeper): Promise<void> {
   *   return keeper.saveAsync();
   * }
   * ```
   */
  public saveAsync(): Promise<void>;

  /**
   * Saves the window's newest bounds when an earlier save could not keep them, for example while the runtime was
   * unreachable; does nothing otherwise.
   *
   * @returns A promise that settles once the bounds are kept, or at once when nothing is unsaved.
   * @throws The store's failure as a rejection.
   * @example
   * ```ts
   * import type { WindowBoundsKeeper } from "@noldova/teamrun-shell-desktop";
   *
   * export function catchUpAsync(keeper: WindowBoundsKeeper): Promise<void> {
   *   return keeper.saveUnsavedAsync();
   * }
   * ```
   */
  public saveUnsavedAsync(): Promise<void>;

  /**
   * Cancels a pending save.
   *
   * @example
   * ```ts
   * import type { WindowBoundsKeeper } from "@noldova/teamrun-shell-desktop";
   *
   * export function forget(keeper: WindowBoundsKeeper): void {
   *   keeper.cancelSave();
   * }
   * ```
   */
  public cancelSave(): void;
}

/**
 * How a build presents itself to the Windows taskbar: the app ID its windows group under, the icon, and the command
 * the taskbar and its jump list use to start this same build again. A development build has its own app ID, so it
 * never mixes with an installed TeamRun.
 */
export declare class TaskbarIdentity {
  /**
   * The app user model ID.
   */
  public readonly appId: string;

  /**
   * The file whose icon the taskbar shows: the build's program.
   */
  public readonly iconPath: string;

  /**
   * The command line that starts this build again, each part quoted.
   */
  public readonly relaunchCommand: string;

  /**
   * Creates the identity.
   *
   * @param appId The app user model ID.
   * @param iconPath The file whose icon the taskbar shows.
   * @param relaunchCommand The command line that starts this build again.
   * @throws {ArgumentException} When a part is blank.
   * @example
   * ```ts
   * import { TaskbarIdentity } from "@noldova/teamrun-shell-desktop";
   *
   * export const identity: TaskbarIdentity = new TaskbarIdentity("com.noldova.teamrun", "/opt/teamrun/teamrun", "\"/opt/teamrun/teamrun\"");
   * ```
   */
  public constructor(appId: string, iconPath: string, relaunchCommand: string);

  /**
   * Describes the running build. A packaged build starts again by its program; a development build by Electron with
   * its main script. Both keep the given `--data-dir=`, `--user-data-dir=` and `--device-dir=` arguments, resolved to
   * absolute paths, so the relaunch reaches the running instance's single-instance lock from any working directory.
   * A packaged build takes the application ID. A development build takes the development application ID followed by
   * the first eight hexadecimal digits of the SHA-256 of its checkout's path, the folder three levels above the main
   * script's, so each checkout has its own taskbar entry and relaunches itself.
   *
   * @param isPackaged Whether the build is packaged.
   * @param executablePath The running program.
   * @param mainScript The desktop's main script, which a development build passes to Electron.
   * @param argv The process's command-line arguments.
   * @param workingDirectory The directory relative paths in the arguments resolve against.
   * @returns The identity.
   * @example
   * ```ts
   * import { TaskbarIdentity } from "@noldova/teamrun-shell-desktop";
   *
   * export const identity: TaskbarIdentity = TaskbarIdentity.create(false, "/checkout/electron", "/checkout/main.js", ["--data-dir=data"], "/checkout");
   * ```
   */
  public static create(isPackaged: boolean, executablePath: string, mainScript: string, argv: readonly string[], workingDirectory: string): TaskbarIdentity;

  /**
   * The details for `BrowserWindow.setAppDetails`.
   *
   * @returns The app ID, icon, relaunch command and the product's name as the relaunch entry's name.
   * @example
   * ```ts
   * import type { AppDetailsOptions } from "electron";
   * import type { TaskbarIdentity } from "@noldova/teamrun-shell-desktop";
   *
   * export function detailsOf(identity: TaskbarIdentity): AppDetailsOptions {
   *   return identity.toAppDetails();
   * }
   * ```
   */
  public toAppDetails(): AppDetailsOptions;
}

/**
 * What a utility process is asked to start: a program, its arguments, the file for its standard error and its environment.
 */
export declare class DetachedStartRequest {
  /**
   * The program to start.
   */
  public readonly executable: string;

  /**
   * The program's arguments.
   */
  public readonly launchArguments: readonly string[];

  /**
   * The file the program's standard error is appended to.
   */
  public readonly errorFile: string;

  /**
   * The program's environment. The utility process itself runs with the desktop's environment, since a variable such as `ELECTRON_RUN_AS_NODE` must reach the program but not the utility process.
   */
  public readonly environment: Readonly<Record<string, string>>;

  /**
   * Creates the request.
   *
   * @param executable The program; not whitespace only.
   * @param launchArguments The program's arguments, copied.
   * @param errorFile The file for standard error; not whitespace only.
   * @param environment The program's environment; variables without a value are left out.
   * @throws ArgumentException synchronously when the program or the file is empty or whitespace only.
   * @example
   * ```ts
   * import { DetachedStartRequest } from "@noldova/teamrun-shell-desktop";
   *
   * export const request: DetachedStartRequest = new DetachedStartRequest(process.execPath, ["--version"], "start.log", process.env);
   * ```
   */
  public constructor(executable: string, launchArguments: readonly string[], errorFile: string, environment: NodeJS.ProcessEnv);

  /**
   * Reads a request from a message.
   *
   * @param value The message: `executable`, `arguments`, `errorFile` and `environment`.
   * @returns The request.
   * @throws JsonException synchronously when a field is missing or invalid, or an environment variable's value is not text.
   * @example
   * ```ts
   * import { DetachedStartRequest } from "@noldova/teamrun-shell-desktop";
   *
   * export const request: DetachedStartRequest = DetachedStartRequest.fromJson({ executable: "node", arguments: [], errorFile: "start.log", environment: { PATH: "/usr/bin" } });
   * ```
   */
  public static fromJson(value: unknown): DetachedStartRequest;

  /**
   * Writes the request as a message.
   *
   * @returns The message.
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { DetachedStartRequest } from "@noldova/teamrun-shell-desktop";
   *
   * export const message: JsonObject = new DetachedStartRequest("node", [], "start.log", {}).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A utility process's answer to a start request: the started process's id, or why it could not start.
 */
export declare class DetachedStartReply {
  /**
   * The started process's id, or `null` when the start failed.
   */
  public readonly processId: number | null;

  /**
   * Why the start failed, or `null` when it succeeded.
   */
  public readonly failure: string | null;

  private constructor();

  /**
   * Creates the reply of a successful start.
   *
   * @param processId The started process's id.
   * @returns The reply.
   * @example
   * ```ts
   * import { DetachedStartReply } from "@noldova/teamrun-shell-desktop";
   *
   * export const reply: DetachedStartReply = DetachedStartReply.started(4120);
   * ```
   */
  public static started(processId: number): DetachedStartReply;

  /**
   * Creates the reply of a failed start.
   *
   * @param failure Why the start failed.
   * @returns The reply.
   * @example
   * ```ts
   * import { DetachedStartReply } from "@noldova/teamrun-shell-desktop";
   *
   * export const reply: DetachedStartReply = DetachedStartReply.failed("The program is missing.");
   * ```
   */
  public static failed(failure: string): DetachedStartReply;

  /**
   * Reads a reply from a message.
   *
   * @param value The message: `processId` and `failure`, exactly one of them not `null`.
   * @returns The reply.
   * @throws JsonException synchronously when a field is invalid or the message carries both outcomes or neither.
   * @example
   * ```ts
   * import { DetachedStartReply } from "@noldova/teamrun-shell-desktop";
   *
   * export const reply: DetachedStartReply = DetachedStartReply.fromJson({ processId: 4120, failure: null });
   * ```
   */
  public static fromJson(value: unknown): DetachedStartReply;

  /**
   * Returns the started process's id.
   *
   * @returns The process id.
   * @throws LaunchException synchronously when the start failed; its message carries the failure.
   * @example
   * ```ts
   * import { DetachedStartReply } from "@noldova/teamrun-shell-desktop";
   *
   * export const processId: number = DetachedStartReply.started(4120).requireProcessId();
   * ```
   */
  public requireProcessId(): number;

  /**
   * Writes the reply as a message.
   *
   * @returns The message.
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { DetachedStartReply } from "@noldova/teamrun-shell-desktop";
   *
   * export const message: JsonObject = DetachedStartReply.started(4120).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Starts the runtime through a short-lived Electron utility process, so that the runtime inherits none of the desktop's handles. Electron's main process keeps its standard handles inheritable, and Node.js starts every child with handle inheritance on; a utility process, which Chromium starts with only its listed handles, then starts the runtime and ends.
 */
export declare class UtilityProcessStarter implements IProcessStarter {
  /**
   * Creates the starter.
   *
   * @param host Electron's `utilityProcess`.
   * @param entryPath The script the utility process runs. Defaults to {@link UtilityProcessStarter.entryPath}.
   * @example
   * ```ts
   * import { type IUtilityProcessHost, UtilityProcessStarter } from "@noldova/teamrun-shell-desktop";
   *
   * export function createStarter(host: IUtilityProcessHost): UtilityProcessStarter {
   *   return new UtilityProcessStarter(host);
   * }
   * ```
   */
  public constructor(host: IUtilityProcessHost, entryPath?: string);

  /**
   * The path of the package's utility script, which answers one start request and ends.
   *
   * @example
   * ```ts
   * import { UtilityProcessStarter } from "@noldova/teamrun-shell-desktop";
   *
   * export const script: string = UtilityProcessStarter.entryPath;
   * ```
   */
  public static get entryPath(): string;

  /**
   * Asks a new utility process to start a program detached and returns the program's process id. The desktop acknowledges the answer, and the utility process ends only then, so its exit never arrives before its answer.
   *
   * @param executable The program to run.
   * @param launchArguments The program's arguments.
   * @param environment The program's environment, which the request carries; the utility process keeps the desktop's own.
   * @param errorFile The file the program's standard error is appended to.
   * @returns A promise of the started program's process id.
   * @throws LaunchException as a rejection when the utility process cannot start the program or ends without answering.
   * @throws JsonException as a rejection when the answer is not a start reply.
   * @example
   * ```ts
   * import { type IUtilityProcessHost, UtilityProcessStarter } from "@noldova/teamrun-shell-desktop";
   *
   * export function startAsync(host: IUtilityProcessHost, errorFile: string): Promise<number> {
   *   return new UtilityProcessStarter(host).startAsync(process.execPath, ["--version"], process.env, errorFile);
   * }
   * ```
   */
  public startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string): Promise<number>;
}

/**
 * The utility process's side of a detached start: it reads the request, starts the program and answers.
 */
export declare class DetachedStart {
  /**
   * Answers one start request and waits for the parent process to acknowledge the answer, so that the utility process ends only after its answer arrived; a failure is answered, never thrown.
   *
   * @param message The start request.
   * @param port The utility process's parent port.
   * @param starter Starts the program. Defaults to the runtime package's `ChildProcessStarter`.
   * @returns A promise that settles once the parent process acknowledges the answer.
   * @example
   * ```ts
   * import { DetachedStart, type IParentPort } from "@noldova/teamrun-shell-desktop";
   *
   * export function answerAsync(message: unknown, port: IParentPort): Promise<void> {
   *   return DetachedStart.runAsync(message, port);
   * }
   * ```
   */
  public static runAsync(message: unknown, port: IParentPort, starter?: IProcessStarter): Promise<void>;
}
