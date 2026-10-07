/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Stats } from "node:fs";
import type { Writable } from "node:stream";

import type {
  AppDetailsOptions, BrowserWindowConstructorOptions, MenuItemConstructorOptions, MessageBoxOptions, MessageBoxReturnValue, NotificationConstructorOptions, Rectangle, RenderProcessGoneDetails,
  TitleBarOverlayOptions, WindowOpenHandlerResponse
} from "electron";
import { type CancellationToken, type Logger, type ProgressInfo, Provider, type ResolvedUpdateFileInfo, type UpdateInfo } from "electron-updater";
import type { ProviderRuntimeOptions } from "electron-updater/out/providers/Provider.js";

import { type ArgumentException, Exception, type ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import type { JsonException, JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import type { Event, NotificationBroadcast, QualifiedName, QuitAnswer, Response, RuntimeHandover, StopPolicy, UpdateProcess, WindowStateKey, WorkReport } from "@noldova/teamrun-shell-protocol";
import type { AttachOptions, ConnectionException, DataDirectory, DiagnosticRedactor, Installation, IProcessStarter, IRuntimeClientListener, IWindowsProcessApi, LaunchException, LaunchSettings, ProcessPresence, SystemCommand, UpdateBarrier, UpdateBarrierStatus } from "@noldova/teamrun-shell-runtime";

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
   * TeamRun is saving the window's work and closing for an update.
   */
  Updating = "Updating",

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
 * What installing the command on the macOS PATH did.
 */
export declare enum PathCommandOutcome {
  /**
   * The link now points to the command inside the app.
   */
  Installed = "Installed",

  /**
   * The link already pointed to the command inside this app, so nothing changed.
   */
  AlreadyInstalled = "AlreadyInstalled",

  /**
   * A file that is not a link has the link's name; it is left alone.
   */
  Occupied = "Occupied",

  /**
   * This build has no command to link, as in a development start.
   */
  Missing = "Missing",

  /**
   * The person cancelled the system's administrator prompt.
   */
  Cancelled = "Cancelled"
}

/**
 * How quitting goes on after the question about work in progress.
 */
export declare enum QuitOutcome {
  /**
   * Quit, stopping the runtime only if it is idle; no work is in progress, it finished, or it could not be read.
   */
  Quit = "Quit",

  /**
   * Quit, stopping the runtime's work and the runtime.
   */
  StopWork = "StopWork",

  /**
   * Stop quitting; TeamRun stays open.
   */
  Stay = "Stay"
}

/**
 * What becomes of an error a window's page reports, under its {@link WindowErrorLimit}.
 */
export declare enum WindowErrorAdmission {
  /**
   * Write the error to the log.
   */
  Write = "Write",

  /**
   * Leave the error out, and write once that the rest of the period's errors are left out.
   */
  Notice = "Notice",

  /**
   * Leave the error out without a word; the notice was already written.
   */
  Drop = "Drop"
}

/**
 * How the desktop's main process failed, for {@link MainProcessRecovery}.
 */
export declare enum MainProcessFailureKind {
  /**
   * An exception it did not catch.
   */
  UncaughtException = "UncaughtException",

  /**
   * A rejection it did not handle.
   */
  UnhandledRejection = "UnhandledRejection"
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
 * Decides whether a window may close.
 */
export interface ICloseGuard {
  /**
   * Decides whether the window may close: another window stays open, or TeamRun keeps running without windows. When
   * it is the last window and TeamRun cannot keep running, the guard quits TeamRun instead and keeps the window open
   * until the quit closes it.
   *
   * @param prompt The closing window.
   * @returns A promise of whether the window may close.
   * @example
   * ```ts
   * import type { ICloseGuard, IQuitPrompt } from "@noldova/teamrun-shell-desktop";
   *
   * export function mayCloseAsync(guard: ICloseGuard, prompt: IQuitPrompt): Promise<boolean> {
   *   return guard.canCloseAsync(prompt);
   * }
   * ```
   */
  canCloseAsync(prompt: IQuitPrompt): Promise<boolean>;
}

/**
 * What {@link QuitFlow} asks of the desktop as TeamRun closes windows and quits.
 */
export interface IQuitHost {
  /**
   * Whether TeamRun has decided to quit and is closing its windows.
   *
   * @returns Whether TeamRun is exiting.
   * @example
   * ```ts
   * import type { IQuitHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function isQuitting(host: IQuitHost): boolean {
   *   return host.isExiting();
   * }
   * ```
   */
  isExiting(): boolean;

  /**
   * Whether TeamRun keeps running when its last window closes: on macOS, and while the tray icon really shows.
   *
   * @returns Whether TeamRun keeps running without windows.
   * @example
   * ```ts
   * import type { IQuitHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function staysInBackground(host: IQuitHost): boolean {
   *   return host.keepsRunningWithoutWindows();
   * }
   * ```
   */
  keepsRunningWithoutWindows(): boolean;

  /**
   * Whether a window is the last one open.
   *
   * @param prompt The window.
   * @returns Whether no other window is open.
   * @example
   * ```ts
   * import type { IQuitHost, IQuitPrompt } from "@noldova/teamrun-shell-desktop";
   *
   * export function closesLast(host: IQuitHost, prompt: IQuitPrompt): boolean {
   *   return host.isLast(prompt);
   * }
   * ```
   */
  isLast(prompt: IQuitPrompt): boolean;

  /**
   * Asks every open window to save, as closing it would.
   *
   * @returns A promise of whether every window saved; a window whose save failed keeps TeamRun open.
   * @example
   * ```ts
   * import type { IQuitHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function saveAsync(host: IQuitHost): Promise<boolean> {
   *   return host.saveAllAsync();
   * }
   * ```
   */
  saveAllAsync(): Promise<boolean>;

  /**
   * Asks the runtime to stop unless another client uses it, which keeps it running with its work.
   *
   * @param policy How the runtime treats work in progress when no other client uses it.
   * @returns A promise of whether the runtime refused because work is in progress under {@link StopPolicy.IfIdle}.
   * @example
   * ```ts
   * import { StopPolicy } from "@noldova/teamrun-shell-protocol";
   * import type { IQuitHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function isBusyAsync(host: IQuitHost): Promise<boolean> {
   *   return host.stopAsync(StopPolicy.IfIdle);
   * }
   * ```
   */
  stopAsync(policy: StopPolicy): Promise<boolean>;

  /**
   * Finds the window that asks the question about work in progress, opening one when none is open.
   *
   * @returns A promise of the window once its page has painted, or `null` when it closed first.
   * @example
   * ```ts
   * import type { IQuitHost, IQuitPrompt } from "@noldova/teamrun-shell-desktop";
   *
   * export function findAsync(host: IQuitHost): Promise<IQuitPrompt | null> {
   *   return host.findPromptAsync();
   * }
   * ```
   */
  findPromptAsync(): Promise<IQuitPrompt | null>;

  /**
   * Asks the application to quit, which starts {@link QuitFlow.quitAsync}.
   * @example
   * ```ts
   * import type { IQuitHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function startQuitting(host: IQuitHost): void {
   *   host.quit();
   * }
   * ```
   */
  quit(): void;

  /**
   * Closes every window without asking again and quits the application.
   * @example
   * ```ts
   * import type { IQuitHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function end(host: IQuitHost): void {
   *   host.exit();
   * }
   * ```
   */
  exit(): void;
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
   * Whether TeamRun asks before it stops for an update rather than before it quits.
   */
  public readonly isUpdate: boolean;

  /**
   * Creates the question.
   *
   * @param descriptions The work in progress.
   * @param isWaiting Whether the person chose to wait.
   * @param isUpdate Whether TeamRun asks before it stops for an update.
   * @example
   * ```ts
   * import { QuitQuestion } from "@noldova/teamrun-shell-desktop";
   *
   * export const question: QuitQuestion = new QuitQuestion(["Indexing the project"], false, false);
   * ```
   */
  public constructor(descriptions: readonly string[], isWaiting: boolean, isUpdate: boolean);

  /**
   * Returns the form the window receives.
   *
   * @returns The `descriptions`, `isWaiting` and `isUpdate` fields.
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { QuitQuestion } from "@noldova/teamrun-shell-desktop";
   *
   * export const json: JsonObject = new QuitQuestion([], true, false).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Stops every process of the installation before an update replaces its files, then calls the updater's handoff:
 * it asks about work in progress, holds the launch barrier, has every runtime's clients save, stops every runtime and
 * verifies by process id and start that each process has exited.
 */
export declare class UpdateStop {
  /**
   * Creates the update stop.
   *
   * @param installation The installation whose record and launch barrier it uses.
   * @param presence Finds processes in the process table.
   * @param connectAsync Connects to the runtime of a recorded data directory as the client `update`, without starting
   * one; resolves `null` when the directory is not in use by this installation.
   * @param askAsync Asks the person about the work in progress, listed by data directory, and can read it again to
   * keep the list current while the person waits for it; resolves the work the person agreed to stop, the list shown
   * when they chose Stop or empty when they waited until none was left, or `null` to cancel the update.
   * @param processId The coordinating desktop's process id.
   * @param productVersion The coordinating desktop's product version.
   * @param now Reads the current time, in milliseconds.
   * @param wait Resolves after the given number of milliseconds.
   * @param restart Starts the replaced AppImage once this desktop has exited, or `null` when the desktop does not run
   * from an AppImage.
   * @param log Records a barrier that could not be removed after the update stopped.
   * @example
   * ```ts
   * import { setTimeout as delay } from "node:timers/promises";
   *
   * import { AppImageRestart, UpdateStop } from "@noldova/teamrun-shell-desktop";
   * import { ChildProcessStarter, type Installation, ProcessPresence, SystemCommand } from "@noldova/teamrun-shell-runtime";
   *
   * export function create(installation: Installation, errorFile: string): UpdateStop {
   *   const restart = AppImageRestart.find(process.platform, process.env, process.execPath, process.argv.slice(1), new ChildProcessStarter(), process.pid, errorFile);
   *   return new UpdateStop(
   *     installation, ProcessPresence.create(process.platform, new SystemCommand()), () => Promise.resolve(null), () => Promise.resolve(null),
   *     process.pid, "0.2.0", Date.now, t => delay(t), restart, console.error);
   * }
   * ```
   */
  public constructor(
    installation: Installation,
    presence: Pick<ProcessPresence, "stampAsync" | "isRunningAsync">,
    connectAsync: (dataDirectory: string) => Promise<IUpdateTarget | null>,
    askAsync: (work: readonly string[], readWorkAsync: () => Promise<readonly string[]>) => Promise<readonly string[] | null>,
    processId: number,
    productVersion: string,
    now: () => number,
    wait: (milliseconds: number) => Promise<void>,
    restart: AppImageRestart | null,
    log: (text: string) => void);

  /**
   * Stops the installation for an update and calls the handoff. It holds the launch barrier as `Preparing`, asks each
   * runtime `shell.update`, then reads each runtime's work again: work the person did not agree to stop fails the
   * update, and `shell.stop` stops the work of a runtime that still has the work they agreed to stop and otherwise
   * stops only if idle. It waits up to 10 seconds for every runtime and every process they listed except the desktops to exit,
   * sets the barrier to `Closing`, waits up to 10 more seconds for the other desktops, those the runtimes listed and
   * those recorded in the installation that still run, then sets it to `HandedOff`. From an AppImage, it then starts the
   * restart before the handoff, and ends the restart when the handoff fails. Every connection closes when it
   * ends. When the handoff names the process that took over, the barrier records it, so the barrier holds while that
   * process runs; when that process cannot be found or the record cannot be written, the barrier stays without it.
   *
   * @param version The version being installed.
   * @param handOffAsync The updater's handoff, which starts what replaces the application's files and resolves that
   * process's id, or `null` when the platform does not give one.
   * @returns A promise of `true` once the handoff has run, or `false` when the person cancelled at the question about
   * work, with nothing changed.
   * @throws {UpdateStopException} Rejected with the reason when another update holds the barrier, work started
   * meanwhile, a runtime refused or something did not save, or a process or desktop did not exit in time; any other
   * failure, as of reading the process table, starting the AppImage restart or the handoff, gives the reason that the
   * update stopped on an unexpected error, with the failure as its cause. The barrier it held is removed first, so
   * every surviving runtime and desktop resumes. Once the handoff has run, the barrier stays.
   * @throws {UpdateHandoffException} Rejected as the handoff rejected it, after the same cleanup.
   * @example
   * ```ts
   * import type { UpdateStop } from "@noldova/teamrun-shell-desktop";
   *
   * export function restartAsync(stop: UpdateStop, handOffAsync: () => Promise<number | null>): Promise<boolean> {
   *   return stop.runAsync("0.3.0", handOffAsync);
   * }
   * ```
   */
  public runAsync(version: string, handOffAsync: () => Promise<number | null>): Promise<boolean>;
}

/**
 * Connects an {@link UpdateStop} to the runtime of a data directory in the installation's record, as the client
 * `update`. A directory without discovery that no runtime owns, or whose discovery names another program, is skipped.
 * A directory owned without discovery has a runtime that is still starting: the connector waits up to 15 seconds for
 * its discovery, skips the directory when the ownership ends first and fails the update when the time runs out. It
 * attaches without starting a runtime or taking over another build's, and identifies the runtime by the process id its
 * discovery names.
 */
export declare class UpdateTargetConnector {
  /**
   * Creates the connector.
   *
   * @param installationFolder The installation's folder.
   * @param locate Gives the folder of the installation a program belongs to, as `Installation.locate` does.
   * @param createLauncher Creates the launcher of a data directory.
   * @param presence Identifies the runtime's process.
   * @param now Reads the current time, in milliseconds.
   * @param wait Resolves after the given number of milliseconds.
   * @example
   * ```ts
   * import { setTimeout as delay } from "node:timers/promises";
   *
   * import { type IRuntimeLauncher, UpdateTargetConnector } from "@noldova/teamrun-shell-desktop";
   * import { type DataDirectory, ProcessPresence, SystemCommand } from "@noldova/teamrun-shell-runtime";
   *
   * export function create(createLauncher: (dataDirectory: DataDirectory) => IRuntimeLauncher): UpdateTargetConnector {
   *   return new UpdateTargetConnector("/home/person/.config/TeamRun/installations/0123456789abcdef", () => "/home/person/.config/TeamRun/installations/0123456789abcdef",
   *     createLauncher, ProcessPresence.create("linux", new SystemCommand()), Date.now, t => delay(t));
   * }
   * ```
   */
  public constructor(
    installationFolder: string,
    locate: (program: string) => string,
    createLauncher: (dataDirectory: DataDirectory) => IRuntimeLauncher,
    presence: Pick<ProcessPresence, "stampAsync">,
    now: () => number,
    wait: (milliseconds: number) => Promise<void>);

  /**
   * Connects to the data directory's runtime.
   *
   * @param root The data directory's root.
   * @returns A promise of the runtime, its process and the connection, or `null` when the directory is skipped or its
   * runtime stopped before the connection.
   * @throws {UpdateStopException} Rejected with a readable reason when the runtime cannot be reached or its process
   * cannot be identified; the connection is then closed.
   * @example
   * ```ts
   * import type { IUpdateTarget, UpdateTargetConnector } from "@noldova/teamrun-shell-desktop";
   *
   * export function connectAsync(connector: UpdateTargetConnector): Promise<IUpdateTarget | null> {
   *   return connector.connectAsync("/home/person/.teamrun");
   * }
   * ```
   */
  public connectAsync(root: string): Promise<IUpdateTarget | null>;
}

/**
 * The Linux handoff of an update: replaces the AppImage file in place with the downloaded one, keeping its location,
 * its name and its permissions, so its launchers still start it. The download is copied to a file with a unique name
 * beside the AppImage, created only when no file has that name, given the AppImage's permissions and flushed to disk,
 * and then renamed over the AppImage, so the AppImage is always either the old version or the whole new one; the
 * folder is then flushed to disk too, and a flush that fails is logged, since the AppImage is already replaced. Before
 * the copy, the copies an earlier replacement of that AppImage left behind are removed: only the files named
 * `.<AppImage name>.<UUID>.part`, the name a replacement gives its copy. It runs only as the handoff, while the
 * update's launch barrier holds, so no other replacement of the AppImage runs. A link to the AppImage is followed and
 * the file it names is replaced. The download is kept, and on any failure the copy is removed and the AppImage is
 * left as it was. No process takes the handoff; {@link AppImageRestart} starts the new version once the desktop has
 * exited.
 */
export declare class AppImageReplacement {
  /**
   * Creates the replacement of an AppImage file.
   *
   * @param image The AppImage file, or a link to it.
   * @param log Writes a line to the desktop's log, such as a folder that could not be flushed to disk after the replacement.
   * @example
   * ```ts
   * import { AppImageReplacement } from "@noldova/teamrun-shell-desktop";
   *
   * export const replacement: AppImageReplacement = new AppImageReplacement("/home/person/Applications/TeamRun.AppImage", console.log);
   * ```
   */
  public constructor(image: string, log: (text: string) => void);

  /**
   * Replaces the AppImage with the downloaded file.
   *
   * @param download The downloaded and validated AppImage of the new version.
   * @returns A promise that resolves once the AppImage has been replaced.
   * @throws {UpdateHandoffException} Rejected with the reason when the AppImage cannot be read, its folder cannot be
   * written, or the download cannot be copied or put in its place; the AppImage is then left as it was.
   * @example
   * ```ts
   * import { AppImageReplacement } from "@noldova/teamrun-shell-desktop";
   *
   * export function handOffAsync(image: string, download: string): Promise<void> {
   *   return new AppImageReplacement(image, console.log).replaceAsync(download);
   * }
   * ```
   */
  public replaceAsync(download: string): Promise<void>;
}

/**
 * Hands a ready update over to what installs it, once every process of the installation has stopped: the step
 * `UpdateStop.runAsync` runs last. Each platform's handoff first hashes the downloaded file again and refuses one whose
 * SHA-512 no longer matches the ready record.
 */
export interface IUpdateHandoff {
  /**
   * Why this copy of TeamRun can never install an update, known before anything is downloaded or stopped, or
   * `null` when it can. The update controller then shows the update as failed with this reason instead of downloading
   * it or offering Restart to update.
   *
   * @example
   * ```ts
   * import type { IUpdateHandoff } from "@noldova/teamrun-shell-desktop";
   *
   * export function canInstall(handoff: IUpdateHandoff): boolean {
   *   return handoff.refusal === null;
   * }
   * ```
   */
  readonly refusal: string | null;

  /**
   * Hands the update over.
   *
   * @param record The ready update.
   * @returns A promise of the id of the process that takes the update over, or `null` when none does.
   * @throws {UpdateHandoffException} Rejected with the reason when the update cannot be handed over; nothing is installed.
   * @example
   * ```ts
   * import type { IUpdateHandoff, UpdateReadyRecord } from "@noldova/teamrun-shell-desktop";
   *
   * export function handOffAsync(handoff: IUpdateHandoff, record: UpdateReadyRecord): Promise<number | null> {
   *   return handoff.handOffAsync(record);
   * }
   * ```
   */
  handOffAsync(record: UpdateReadyRecord): Promise<number | null>;

  /**
   * Removes what an earlier handoff of the installation left behind. The desktop calls it at start, before its
   * updater.
   *
   * @returns A promise that resolves once that is removed or the failure is logged; it never rejects.
   * @example
   * ```ts
   * import type { IUpdateHandoff } from "@noldova/teamrun-shell-desktop";
   *
   * export function tidyAsync(handoff: IUpdateHandoff): Promise<void> {
   *   return handoff.clearAsync();
   * }
   * ```
   */
  clearAsync(): Promise<void>;
}

/**
 * The part of Electron's `autoUpdater`, Squirrel.Mac, that stages a macOS update.
 */
export interface INativeUpdater {
  /**
   * Asks Squirrel.Mac to fetch the update from the feed electron-updater set and stage it.
   *
   * @example
   * ```ts
   * import type { INativeUpdater } from "@noldova/teamrun-shell-desktop";
   *
   * export function stage(updater: INativeUpdater): void {
   *   updater.checkForUpdates();
   * }
   * ```
   */
  checkForUpdates(): void;

  /**
   * Listens for an event: `update-downloaded` once the update is staged, `error` with the failure.
   *
   * @param event The event's name.
   * @param listener Receives the event's values.
   * @returns The updater.
   * @example
   * ```ts
   * import type { INativeUpdater } from "@noldova/teamrun-shell-desktop";
   *
   * export function onStaged(updater: INativeUpdater, run: () => void): void {
   *   updater.on("update-downloaded", run);
   * }
   * ```
   */
  on(event: string, listener: (...values: unknown[]) => void): unknown;

  /**
   * Listens for the next occurrence of an event only.
   *
   * @param event The event's name.
   * @param listener Receives the event's values.
   * @returns The updater.
   * @example
   * ```ts
   * import type { INativeUpdater } from "@noldova/teamrun-shell-desktop";
   *
   * export function onFailure(updater: INativeUpdater, run: (error: unknown) => void): void {
   *   updater.once("error", run);
   * }
   * ```
   */
  once(event: string, listener: (...values: unknown[]) => void): unknown;

  /**
   * Stops listening for an event.
   *
   * @param event The event's name.
   * @param listener A listener given to {@link INativeUpdater.on}.
   * @returns The updater.
   * @example
   * ```ts
   * import type { INativeUpdater } from "@noldova/teamrun-shell-desktop";
   *
   * export function offStaged(updater: INativeUpdater, run: () => void): void {
   *   updater.removeListener("update-downloaded", run);
   * }
   * ```
   */
  removeListener(event: string, listener: (...values: unknown[]) => void): unknown;

  /**
   * Quits the application, so the ShipIt process installs the staged update, and has it start the new version.
   *
   * @throws {Error} When Squirrel.Mac has no staged update to install.
   * @example
   * ```ts
   * import type { INativeUpdater } from "@noldova/teamrun-shell-desktop";
   *
   * export function install(updater: INativeUpdater): void {
   *   updater.quitAndInstall();
   * }
   * ```
   */
  quitAndInstall(): void;
}

/**
 * The ShipIt process Squirrel.Mac starts, as the launchd job `<bundle id>.ShipIt`, once it has staged an update; it
 * installs the update when the desktop quits.
 */
export interface IShipItProcess {
  /**
   * Finds the job's process.
   *
   * @returns A promise of its process id, or `null` when none runs.
   * @example
   * ```ts
   * import type { IShipItProcess } from "@noldova/teamrun-shell-desktop";
   *
   * export function findAsync(shipIt: IShipItProcess): Promise<number | null> {
   *   return shipIt.findAsync();
   * }
   * ```
   */
  findAsync(): Promise<number | null>;

  /**
   * Removes the job, so quitting installs nothing.
   *
   * @returns A promise that resolves once the job is removed.
   * @example
   * ```ts
   * import type { IShipItProcess } from "@noldova/teamrun-shell-desktop";
   *
   * export function removeAsync(shipIt: IShipItProcess): Promise<void> {
   *   return shipIt.removeAsync();
   * }
   * ```
   */
  removeAsync(): Promise<void>;

  /**
   * Removes the job only when it is listed without a process, as a finished install leaves it.
   *
   * @returns A promise that resolves once such a job is removed, or at once when there is none.
   * @example
   * ```ts
   * import type { IShipItProcess } from "@noldova/teamrun-shell-desktop";
   *
   * export function tidyAsync(shipIt: IShipItProcess): Promise<void> {
   *   return shipIt.removeStoppedAsync();
   * }
   * ```
   */
  removeStoppedAsync(): Promise<void>;
}

/**
 * The Windows handoff of an update. It copies the downloaded installer into a new folder of its own under
 * `handoff` in the installation's folder, restricted to the current user, with a copy that fails when the file
 * exists. It then holds the copy open with read sharing only, so it can be read and started but not written,
 * renamed or deleted, hashes it again and gives it to the installer's start, which checks its publisher and starts
 * it. The installer reads its own file after it has started, so the copy stays held until this desktop exits; a
 * failure lets it go and removes its folder. A later start removes the `handoff` folder, which a running installer
 * keeps in place.
 */
export declare class InstallerHandoff implements IUpdateHandoff {
  /**
   * Always `null`: whether the installer may run is known only once it is copied and its publisher checked.
   *
   * @example
   * ```ts
   * import type { InstallerHandoff } from "@noldova/teamrun-shell-desktop";
   *
   * export function canInstall(handoff: InstallerHandoff): boolean {
   *   return handoff.refusal === null;
   * }
   * ```
   */
  public readonly refusal: string | null;

  /**
   * Creates the handoff.
   *
   * @param installationFolder The installation's folder.
   * @param protectAsync Restricts a new folder to the current user.
   * @param files Holds a file open for reading and closes it, as `WindowsProcessApi` does.
   * @param startAsync Checks the installer's publisher and starts it, resolving to its process id.
   * @param log Records a failed attempt's folder that cannot be removed.
   * @example
   * ```ts
   * import { SystemCommand, WindowsFolderProtector, WindowsProcessApi } from "@noldova/teamrun-shell-runtime";
   * import { InstallerHandoff } from "@noldova/teamrun-shell-desktop";
   *
   * export function create(installationFolder: string, startAsync: (installer: string) => Promise<number>): InstallerHandoff {
   *   const protector = new WindowsFolderProtector(new SystemCommand(), process.env);
   *   return new InstallerHandoff(installationFolder, t => protector.protectAsync(t), new WindowsProcessApi(), startAsync, console.error);
   * }
   * ```
   */
  public constructor(
    installationFolder: string,
    protectAsync: (folder: string) => Promise<void>,
    files: Pick<IWindowsProcessApi, "openFileForReading" | "closeHandle">,
    startAsync: (installer: string) => Promise<number>,
    log: (text: string) => void);

  /**
   * Removes the copies earlier handoffs left in the installation's folder, logging a copy that cannot be removed
   * yet, such as one a running installer holds.
   *
   * @returns A promise that resolves once the copies are removed or the failure is logged; it never rejects.
   * @example
   * ```ts
   * import type { InstallerHandoff } from "@noldova/teamrun-shell-desktop";
   *
   * export function tidyAsync(handoff: InstallerHandoff): Promise<void> {
   *   return handoff.clearAsync();
   * }
   * ```
   */
  public clearAsync(): Promise<void>;

  /**
   * Copies, holds and checks the installer, then starts it.
   *
   * @param record The ready update, whose file is the downloaded installer.
   * @returns A promise of the installer's process id.
   * @throws {StaleUpdateException} Rejected when the copy's SHA-512 no longer matches the ready record.
   * @throws {UpdateHandoffException} Rejected when the folder cannot be made or restricted, the installer cannot be
   * copied, held or read, or the start refuses it, as for a publisher that isn't TeamRun's.
   * @example
   * ```ts
   * import type { InstallerHandoff, UpdateReadyRecord } from "@noldova/teamrun-shell-desktop";
   *
   * export function startAsync(handoff: InstallerHandoff, record: UpdateReadyRecord): Promise<number> {
   *   return handoff.handOffAsync(record);
   * }
   * ```
   */
  public handOffAsync(record: UpdateReadyRecord): Promise<number>;
}

/**
 * The Linux handoff of an update: hashes the downloaded AppImage again and has {@link AppImageReplacement} put it in
 * place of the running one. No process takes the update over; {@link AppImageRestart} starts the new version.
 */
export declare class AppImageHandoff implements IUpdateHandoff {
  /**
   * Why the update cannot be installed when the desktop doesn't run from an AppImage, or `null` when it does.
   *
   * @example
   * ```ts
   * import type { AppImageHandoff } from "@noldova/teamrun-shell-desktop";
   *
   * export function canInstall(handoff: AppImageHandoff): boolean {
   *   return handoff.refusal === null;
   * }
   * ```
   */
  public get refusal(): string | null;

  /**
   * Creates the handoff.
   *
   * @param replacement Replaces the AppImage with the download, or `null` when the desktop doesn't run from an AppImage.
   * @example
   * ```ts
   * import { AppImageHandoff, AppImageReplacement } from "@noldova/teamrun-shell-desktop";
   *
   * export const handoff: AppImageHandoff = new AppImageHandoff(new AppImageReplacement("/home/person/Applications/TeamRun.AppImage", console.log));
   * ```
   */
  public constructor(replacement: Pick<AppImageReplacement, "replaceAsync"> | null);

  /**
   * Checks the download and replaces the AppImage with it.
   *
   * @param record The ready update.
   * @returns A promise of `null` once the AppImage is replaced.
   * @throws {StaleUpdateException} Rejected when the download's SHA-512 no longer matches the ready record.
   * @throws {UpdateHandoffException} Rejected when the desktop doesn't run from an AppImage or the AppImage cannot be
   * replaced.
   * @example
   * ```ts
   * import type { AppImageHandoff, UpdateReadyRecord } from "@noldova/teamrun-shell-desktop";
   *
   * export async function replaceAsync(handoff: AppImageHandoff, record: UpdateReadyRecord): Promise<void> {
   *   await handoff.handOffAsync(record);
   * }
   * ```
   */
  public handOffAsync(record: UpdateReadyRecord): Promise<null>;

  /**
   * Leaves nothing to remove, since a failed replacement removes its own copy; the next replacement removes any copy an interrupted one left.
   *
   * @returns A promise that resolves once that is done or the failure is logged; it never rejects.
   * @example
   * ```ts
   * import type { AppImageHandoff } from "@noldova/teamrun-shell-desktop";
   *
   * export function tidyAsync(handoff: AppImageHandoff): Promise<void> {
   *   return handoff.clearAsync();
   * }
   * ```
   */
  public clearAsync(): Promise<void>;
}

/**
 * The macOS handoff of an update through Squirrel.Mac. When electron-updater has not downloaded the update in this
 * process, as after a restart restored it from the ready record, it checks the feed and downloads again, which
 * reuses the cached ZIP once it matches. It hashes the ZIP again, has Squirrel.Mac fetch it from electron-updater's
 * local feed and stage it, which checks the update's code signature, and gives the ShipIt process that installs it
 * once the desktop quits through `autoUpdater.quitAndInstall`. Only the handoff stages: once staged, any quit
 * installs. So a handoff that fails after asking Squirrel.Mac to stage, or finds no ShipIt process after the stage,
 * removes the ShipIt job, and after the 2 minutes it also removes the job of a stage that finishes later, until the
 * next handoff asks Squirrel.Mac to stage.
 */
export declare class SquirrelHandoff implements IUpdateHandoff {
  /**
   * Always `null`: whether macOS can stage the update is known only once Squirrel tries.
   *
   * @example
   * ```ts
   * import type { SquirrelHandoff } from "@noldova/teamrun-shell-desktop";
   *
   * export function canInstall(handoff: SquirrelHandoff): boolean {
   *   return handoff.refusal === null;
   * }
   * ```
   */
  public readonly refusal: string | null;

  /**
   * Creates the handoff.
   *
   * @param updater The installation's updater.
   * @param native Electron's `autoUpdater`.
   * @param shipIt The ShipIt job of the staged update.
   * @param schedule Runs a callback after a delay and gives what cancels it.
   * @param log Records a ShipIt job that cannot be removed.
   * @example
   * ```ts
   * import { autoUpdater } from "electron";
   * import { type IShipItProcess, type IUpdater, SquirrelHandoff } from "@noldova/teamrun-shell-desktop";
   *
   * export function create(updater: IUpdater, shipIt: IShipItProcess): SquirrelHandoff {
   *   return new SquirrelHandoff(updater, autoUpdater, shipIt, (wait, run) => {
   *     const timer = setTimeout(run, wait);
   *     return () => clearTimeout(timer);
   *   }, console.error);
   * }
   * ```
   */
  public constructor(
    updater: IUpdater,
    native: INativeUpdater,
    shipIt: IShipItProcess,
    schedule: (delay: number, run: () => void) => () => void,
    log: (text: string) => void);

  /**
   * Stages the update and finds the process that installs it.
   *
   * @param record The ready update.
   * @returns A promise of ShipIt's process id.
   * @throws {UpdateException} Rejected when the check or the download again fails.
   * @throws {StaleUpdateException} Rejected when the feed no longer offers the version or the ZIP's SHA-512 no longer
   * matches the ready record.
   * @throws {UpdateHandoffException} Rejected when Squirrel.Mac fails to stage it or hasn't within 2 minutes, or when
   * no ShipIt process waits after the stage or it cannot be looked up.
   * @example
   * ```ts
   * import type { SquirrelHandoff, UpdateReadyRecord } from "@noldova/teamrun-shell-desktop";
   *
   * export function stageAsync(handoff: SquirrelHandoff, record: UpdateReadyRecord): Promise<number> {
   *   return handoff.handOffAsync(record);
   * }
   * ```
   */
  public handOffAsync(record: UpdateReadyRecord): Promise<number>;

  /**
   * Removes the ShipIt job a finished install left without a process, logging a job it cannot remove; a running ShipIt is left alone.
   *
   * @returns A promise that resolves once that is done or the failure is logged; it never rejects.
   * @example
   * ```ts
   * import type { SquirrelHandoff } from "@noldova/teamrun-shell-desktop";
   *
   * export function tidyAsync(handoff: SquirrelHandoff): Promise<void> {
   *   return handoff.clearAsync();
   * }
   * ```
   */
  public clearAsync(): Promise<void>;
}

/**
 * Starts the replaced AppImage after an update, once this desktop has exited. A process that still holds the old
 * version's files keeps the replaced AppImage mounted, so the new version starts from `/bin/bash`, through the runtime
 * launch's `ProcessLaunchCommand`, which closes the descriptors it inherited above standard error, with its startup
 * files and inherited shell options disabled. Bash waits until the desktop that started it is no longer its parent,
 * which a reused process id or an exited desktop its own parent has not yet reaped cannot delay, then starts the
 * AppImage file from the root folder. The environment it starts with leaves out the old mount's `APPIMAGE`, `APPDIR`,
 * `ARGV0` and `OWD`, and removes from `PATH`, `XDG_DATA_DIRS`, `LD_LIBRARY_PATH` and `GSETTINGS_SCHEMA_DIR` the entries
 * the AppImage's `AppRun` added around them, leaving out a variable that held nothing else.
 */
export declare class AppImageRestart {
  private constructor();

  /**
   * Finds the restart of a desktop that runs from an AppImage.
   *
   * @param platform The desktop's platform.
   * @param environment The desktop's environment, whose `APPIMAGE` names the AppImage file and whose `APPDIR` its mount.
   * @param executablePath The desktop's program, which runs from inside the mount.
   * @param launchArguments The arguments the new version starts with.
   * @param starter Starts Bash detached, as a child of the process `processId` names.
   * @param processId The desktop's process id; Bash waits until that process is no longer its parent.
   * @param errorFile The file Bash's standard error is appended to; the new version's output is discarded.
   * @returns The restart, or `null` on Windows and macOS and when the desktop does not run from an AppImage.
   * @example
   * ```ts
   * import { AppImageRestart } from "@noldova/teamrun-shell-desktop";
   * import { ChildProcessStarter } from "@noldova/teamrun-shell-runtime";
   *
   * export function find(errorFile: string): AppImageRestart | null {
   *   return AppImageRestart.find(process.platform, process.env, process.execPath, process.argv.slice(1), new ChildProcessStarter(), process.pid, errorFile);
   * }
   * ```
   */
  public static find(platform: string, environment: NodeJS.ProcessEnv, executablePath: string, launchArguments: readonly string[], starter: IProcessStarter, processId: number,
    errorFile: string): AppImageRestart | null;

  /**
   * Starts Bash, which waits for the desktop to exit and then starts the AppImage.
   *
   * @returns A promise that resolves once Bash has started.
   * @throws LaunchException as a rejection when `/bin/bash` is not executable, `/proc/self/fd` cannot be read or Bash cannot be started.
   * @example
   * ```ts
   * import type { AppImageRestart } from "@noldova/teamrun-shell-desktop";
   *
   * export function startAsync(restart: AppImageRestart): Promise<void> {
   *   return restart.startAsync();
   * }
   * ```
   */
  public startAsync(): Promise<void>;

  /**
   * Ends the Bash that {@link AppImageRestart.startAsync} started, so the AppImage does not start when the desktop
   * later exits. It does nothing before a start, after a cancel, or when Bash has already ended.
   *
   * @example
   * ```ts
   * import type { AppImageRestart } from "@noldova/teamrun-shell-desktop";
   *
   * export function cancel(restart: AppImageRestart): void {
   *   restart.cancel();
   * }
   * ```
   */
  public cancel(): void;
}

/**
 * The Windows handoff of an update: checks the downloaded installer's signature by the publisher again, right before
 * starting it, so a file changed after its download is never run, then starts it quietly with the arguments of an
 * update, `--updated /S --force-run`, so it keeps the existing installation's folder and scope and starts the new
 * version once it has installed it. The installer starts detached, through a starter that gives it none of the
 * desktop's inherited handles, and its process is the one that takes the handoff.
 */
export declare class InstallerStart {
  /**
   * Creates the installer's start.
   *
   * @param starter Starts the installer detached; the desktop's `UtilityProcessStarter`.
   * @param verifyAsync Checks the installer's signature by the publisher, resolving `null` when it is valid and
   * otherwise the reason it is not.
   * @param environment The environment the installer starts with.
   * @param errorFile The file the installer's standard error is appended to.
   * @example
   * ```ts
   * import { InstallerStart } from "@noldova/teamrun-shell-desktop";
   * import { ChildProcessStarter } from "@noldova/teamrun-shell-runtime";
   *
   * export function create(verifyAsync: (installer: string) => Promise<string | null>, errorFile: string): InstallerStart {
   *   return new InstallerStart(new ChildProcessStarter(), verifyAsync, process.env, errorFile);
   * }
   * ```
   */
  public constructor(starter: IProcessStarter, verifyAsync: (installer: string) => Promise<string | null>, environment: NodeJS.ProcessEnv, errorFile: string);

  /**
   * Checks the installer's signature and starts it.
   *
   * @param installer The downloaded installer of the new version.
   * @returns The installer's process id.
   * @throws {UpdateHandoffException} Rejected with the reason when the installer is not signed by the publisher, in
   * which case it is not started, or when it cannot be started.
   * @example
   * ```ts
   * import type { InstallerStart } from "@noldova/teamrun-shell-desktop";
   *
   * export function handOffAsync(start: InstallerStart, installer: string): Promise<number> {
   *   return start.startAsync(installer);
   * }
   * ```
   */
  public startAsync(installer: string): Promise<number>;
}

/**
 * The process that installs a macOS update: Squirrel.Mac's ShipIt, which runs as the launchd job
 * `<bundle identifier>.ShipIt` in the person's session from the moment Squirrel has staged the update, keeps its
 * process id until it has installed it, and installs it once the desktop has quit. Read from `launchctl list`. A
 * staged update installs at any quit, so a handoff that fails after staging removes the job.
 */
export declare class ShipItProcess implements IShipItProcess {
  /**
   * Creates the lookup of the ShipIt job of an application.
   *
   * @param bundleIdentifier The application's bundle identifier, which names the job.
   * @param command Runs `/bin/launchctl`.
   * @example
   * ```ts
   * import { ShipItProcess } from "@noldova/teamrun-shell-desktop";
   * import { SystemCommand } from "@noldova/teamrun-shell-runtime";
   *
   * export const shipIt: ShipItProcess = new ShipItProcess("com.noldova.teamrun", new SystemCommand());
   * ```
   */
  public constructor(bundleIdentifier: string, command: Pick<SystemCommand, "runAsync">);

  /**
   * Finds the ShipIt process, once Squirrel has staged the update.
   *
   * @returns The process id of the running ShipIt job, or `null` when the job is not listed or not running.
   * @throws {UpdateHandoffException} Rejected with the reason when the jobs cannot be listed.
   * @example
   * ```ts
   * import type { ShipItProcess } from "@noldova/teamrun-shell-desktop";
   *
   * export function findAsync(shipIt: ShipItProcess): Promise<number | null> {
   *   return shipIt.findAsync();
   * }
   * ```
   */
  public findAsync(): Promise<number | null>;

  /**
   * Removes the ShipIt job, which ends a ShipIt that is still waiting, so the staged update does not install when
   * the desktop quits. It does nothing when the job is not listed.
   *
   * @returns A promise that resolves once the job is removed.
   * @throws {UpdateHandoffException} Rejected with the reason when the jobs cannot be listed or the job cannot be
   * removed.
   * @example
   * ```ts
   * import type { ShipItProcess } from "@noldova/teamrun-shell-desktop";
   *
   * export function withdrawAsync(shipIt: ShipItProcess): Promise<void> {
   *   return shipIt.removeAsync();
   * }
   * ```
   */
  public removeAsync(): Promise<void>;

  /**
   * Removes the ShipIt job only when it is listed without a process: the job a finished install leaves behind. A
   * desktop calls it at start, before its updater, and a running ShipIt is left alone.
   *
   * @returns A promise that resolves once a stopped job is removed, or at once when there is none.
   * @throws {UpdateHandoffException} Rejected with the reason when the jobs cannot be listed or the job cannot be
   * removed.
   * @example
   * ```ts
   * import type { ShipItProcess } from "@noldova/teamrun-shell-desktop";
   *
   * export function tidyAsync(shipIt: ShipItProcess): Promise<void> {
   *   return shipIt.removeStoppedAsync();
   * }
   * ```
   */
  public removeStoppedAsync(): Promise<void>;
}

/**
 * Asks the person, while TeamRun quits and the runtime has work in progress, whether to wait for the work or stop it,
 * and decides from the answer and the runtime's reports of its work. Reading the work is bounded once; when it fails or
 * times out, quitting goes ahead as it would without work. Reports carry a sequence, so a report heard before an older
 * answer is handled still wins.
 */
export declare class QuitCoordinator {
  /**
   * Creates the coordinator.
   *
   * @param readWorkAsync Reads the runtime's work within its time limit, or `null` when it cannot.
   * @example
   * ```ts
   * import { WorkReport } from "@noldova/teamrun-shell-protocol";
   * import { QuitCoordinator } from "@noldova/teamrun-shell-desktop";
   *
   * export const coordinator: QuitCoordinator = new QuitCoordinator(async () => new WorkReport([], 0));
   * ```
   */
  public constructor(readWorkAsync: () => Promise<WorkReport | null>);

  /**
   * Asks in a window when the runtime has work in progress. While the question is open, the window shows the newest
   * work; quitting goes ahead once no work is left, the window can no longer show the question, or the runtime is gone.
   * A second request while one is open stays.
   *
   * @param prompt The window that asks.
   * @returns A promise of the outcome.
   * @example
   * ```ts
   * import type { IQuitPrompt, QuitCoordinator, QuitOutcome } from "@noldova/teamrun-shell-desktop";
   *
   * export function askAsync(coordinator: QuitCoordinator, prompt: IQuitPrompt): Promise<QuitOutcome> {
   *   return coordinator.askAsync(prompt);
   * }
   * ```
   */
  public askAsync(prompt: IQuitPrompt): Promise<QuitOutcome>;

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
   * Takes the question away and stays, because the person closed the window that shows it; another window is ignored.
   *
   * @param prompt The window that is closing.
   * @example
   * ```ts
   * import type { IQuitPrompt, QuitCoordinator } from "@noldova/teamrun-shell-desktop";
   *
   * export function closing(coordinator: QuitCoordinator, prompt: IQuitPrompt): void {
   *   coordinator.dismiss(prompt);
   * }
   * ```
   */
  public dismiss(prompt: IQuitPrompt): void;

  /**
   * Lets an open question close and quitting go ahead, because the runtime is gone.
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
 * Closes windows and quits TeamRun. Closing the last window quits only when TeamRun cannot keep running without
 * windows. Quitting saves every window first, then asks the runtime to stop if it is idle unless another client uses
 * it; while work is in progress it asks the person, saves again after the answer, and then stops the work or asks the
 * runtime again to stop if it is idle. One quit runs at a time.
 */
export declare class QuitFlow implements ICloseGuard {
  /**
   * Creates the flow.
   *
   * @param host The desktop's windows, runtime and application.
   * @param asker Asks the question about work in progress.
   * @example
   * ```ts
   * import { type IQuitHost, QuitCoordinator, QuitFlow } from "@noldova/teamrun-shell-desktop";
   *
   * export function create(host: IQuitHost): QuitFlow {
   *   return new QuitFlow(host, new QuitCoordinator(async () => null));
   * }
   * ```
   */
  public constructor(host: IQuitHost, asker: QuitCoordinator);

  /**
   * Whether a quit is running: from {@link QuitFlow.quitAsync} until TeamRun exits or stays open.
   */
  public get isQuitting(): boolean;

  /**
   * See {@link ICloseGuard.canCloseAsync}. While a quit runs, closing the window that asks its question cancels the
   * quit; the window is then judged as any other once the quit has ended, and stays open when TeamRun exits.
   *
   * @param prompt The closing window.
   * @returns A promise of whether the window may close.
   * @example
   * ```ts
   * import type { IQuitPrompt, QuitFlow } from "@noldova/teamrun-shell-desktop";
   *
   * export function mayCloseAsync(flow: QuitFlow, prompt: IQuitPrompt): Promise<boolean> {
   *   return flow.canCloseAsync(prompt);
   * }
   * ```
   */
  public canCloseAsync(prompt: IQuitPrompt): Promise<boolean>;

  /**
   * Quits TeamRun, or joins the quit already running.
   *
   * @returns A promise of `null` once TeamRun exits, or of why it stayed open: `Stayed` when the person kept it open,
   * `SaveFailed` when a window could not save.
   * @example
   * ```ts
   * import type { QuitAnswer } from "@noldova/teamrun-shell-protocol";
   * import type { QuitFlow } from "@noldova/teamrun-shell-desktop";
   *
   * export function quitAsync(flow: QuitFlow): Promise<QuitAnswer | null> {
   *   return flow.quitAsync();
   * }
   * ```
   */
  public quitAsync(): Promise<QuitAnswer | null>;
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
   * Runs other programs for the desktop, such as `gdbus` to find a Linux tray.
   */
  readonly programs: IProgramHost;

  /**
   * Identifies processes by process id and start time, for the launch barrier and the update stop.
   */
  readonly presence: Pick<ProcessPresence, "stampAsync" | "isRunningAsync">;

  /**
   * Whether standard input, output or error is a terminal, as when a person starts the desktop at a shell's prompt.
   */
  readonly isTerminal: boolean;

  /**
   * Starts another program, detached, for the hand-over to a newer build.
   *
   * @param executablePath The program.
   * @param args Its arguments: the start's data directory, user data and
   * device directory arguments, so the newer build opens the same data.
   * @param onFailure Called with the reason when the program cannot be started.
   * @example
   * ```ts
   * import type { IDesktopProcess } from "@noldova/teamrun-shell-desktop";
   *
   * export function handOver(process: IDesktopProcess, log: (text: string) => void): void {
   *   process.startDetached("/opt/teamrun/teamrun", ["--data-dir=/home/person/work-data"], t => log(String(t)));
   * }
   * ```
   */
  startDetached(executablePath: string, args: readonly string[], onFailure: (error: Error) => void): void;

  /**
   * Starts another program in its own session, detached, with its standard streams ignored: the copy of itself a
   * desktop started from a terminal starts so that closing the terminal does not end it.
   *
   * @param executablePath The program.
   * @param args Its arguments.
   * @param environment Its environment.
   * @param workingDirectory The folder it starts in.
   * @returns A promise that settles once the program has started.
   * @throws Error asynchronously when the program cannot be started, with the reason the system gives, or a
   * `LaunchException` on Linux when `/bin/bash` is not executable.
   * @example
   * ```ts
   * import type { IDesktopProcess } from "@noldova/teamrun-shell-desktop";
   *
   * export function relaunchAsync(process: IDesktopProcess): Promise<void> {
   *   return process.startDetachedAsync(process.execPath, process.argv.slice(1), process.env, process.workingDirectory);
   * }
   * ```
   */
  startDetachedAsync(executablePath: string, args: readonly string[], environment: NodeJS.ProcessEnv, workingDirectory: string): Promise<void>;

  /**
   * Starts another program detached through the desktop's process starter, which on Windows is a utility process that
   * gives it none of the desktop's handles, with its standard streams ignored: the copy of itself a desktop started
   * from a console on Windows starts so that closing the console does not end it. The program starts in the desktop's
   * working folder. Only after Electron is ready.
   *
   * @param executablePath The program.
   * @param args Its arguments.
   * @param environment Its environment.
   * @returns A promise that settles once the program has started.
   * @throws LaunchException asynchronously when the starter cannot start the program or ends without answering.
   * @example
   * ```ts
   * import type { IDesktopProcess } from "@noldova/teamrun-shell-desktop";
   *
   * export function relaunchAsync(process: IDesktopProcess): Promise<void> {
   *   return process.startApartAsync(process.execPath, process.argv.slice(1), { ...process.env, ELECTRON_NO_ATTACH_CONSOLE: "1" });
   * }
   * ```
   */
  startApartAsync(executablePath: string, args: readonly string[], environment: NodeJS.ProcessEnv): Promise<void>;

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

  /**
   * Hears every exception the main process does not catch. A listener keeps Electron from showing its own error box,
   * which would block the main process.
   *
   * @param listener Receives the error.
   * @example
   * ```ts
   * import type { IDesktopProcess } from "@noldova/teamrun-shell-desktop";
   *
   * export function listen(process: IDesktopProcess, failures: unknown[]): void {
   *   process.onUncaughtException(error => failures.push(error));
   * }
   * ```
   */
  onUncaughtException(listener: (error: unknown) => void): void;

  /**
   * Hears every rejection the main process does not handle. Electron only warns about one, so it never becomes an
   * uncaught exception.
   *
   * @param listener Receives the rejection's reason.
   * @example
   * ```ts
   * import type { IDesktopProcess } from "@noldova/teamrun-shell-desktop";
   *
   * export function listen(process: IDesktopProcess, failures: unknown[]): void {
   *   process.onUnhandledRejection(reason => failures.push(reason));
   * }
   * ```
   */
  onUnhandledRejection(listener: (reason: unknown) => void): void;
}

/**
 * What the desktop's runtime startup needs to follow an update that another
 * desktop, or this one, coordinates.
 */
export interface IUpdateHost {
  /**
   * The desktop's process id, which it reports once its windows have saved.
   */
  readonly processId: number;

  /**
   * Reads the installation's launch barrier.
   *
   * @returns A promise of the barrier, or `null` when there is none.
   * @throws Error Rejected when the barrier cannot be read.
   * @example
   * ```ts
   * import type { IUpdateHost } from "@noldova/teamrun-shell-desktop";
   *
   * export async function readVersionAsync(host: IUpdateHost): Promise<string | undefined> {
   *   return (await host.readBarrierAsync())?.version;
   * }
   * ```
   */
  readBarrierAsync(): Promise<UpdateBarrier | null>;

  /**
   * Tells whether the update has ended, as {@link Installation.hasEndedAsync} does: the barrier is gone, or its holder
   * exited before the handoff.
   *
   * @returns A promise of whether the update has ended.
   * @throws Error Rejected when the barrier cannot be read or its holder cannot be looked up.
   * @example
   * ```ts
   * import type { IUpdateHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function isOverAsync(host: IUpdateHost): Promise<boolean> {
   *   return host.hasUpdateEndedAsync();
   * }
   * ```
   */
  hasUpdateEndedAsync(): Promise<boolean>;

  /**
   * Asks every window to save for the update.
   *
   * @returns A promise of what did not save, empty when everything saved.
   * @example
   * ```ts
   * import type { IUpdateHost } from "@noldova/teamrun-shell-desktop";
   *
   * export async function isSavedAsync(host: IUpdateHost): Promise<boolean> {
   *   return (await host.saveAsync()).length === 0;
   * }
   * ```
   */
  saveAsync(): Promise<readonly string[]>;

  /**
   * Tells the person about the launch barrier a runtime start found, and settles it when they confirm, as
   * {@link UpdateBarrierGate.askAsync} does.
   *
   * @param status What the barrier means for this installation.
   * @returns A promise of `true` to start the runtime again, `false` when the desktop quits.
   * @example
   * ```ts
   * import type { IUpdateHost } from "@noldova/teamrun-shell-desktop";
   * import { UpdateBarrierStatus } from "@noldova/teamrun-shell-runtime";
   *
   * export function askAsync(host: IUpdateHost): Promise<boolean> {
   *   return host.passBarrierAsync(UpdateBarrierStatus.Held);
   * }
   * ```
   */
  passBarrierAsync(status: UpdateBarrierStatus): Promise<boolean>;

  /**
   * Quits the desktop at once, without asking about work or saving again.
   *
   * @example
   * ```ts
   * import type { IUpdateHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function close(host: IUpdateHost): void {
   *   host.quit();
   * }
   * ```
   */
  quit(): void;
}

/**
 * One runtime of the installation that an update stops: its data directory,
 * its process and the update stop's connection to it as the client `update`.
 */
export interface IUpdateTarget {
  /**
   * The data directory the runtime owns.
   */
  readonly dataDirectory: string;

  /**
   * The runtime's process, by process id and start.
   */
  readonly runtime: UpdateProcess;

  /**
   * The connection to the runtime.
   */
  readonly connection: IRuntimeConnection;
}

/**
 * A connection to the runtime, as `RuntimeClient` provides it.
 */
export interface IRuntimeConnection {
  /**
   * Whether the connection is still open; `false` once it has ended, from
   * either side.
   */
  readonly isConnected: boolean;

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

  /**
   * Finds the primary display, where a window without a position opens.
   *
   * @returns The primary display, with its work area in screen pixels.
   * @example
   * ```ts
   * import type { IDisplayHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function primaryWidth(displays: IDisplayHost): number {
   *   return displays.getPrimaryDisplay().workArea.width;
   * }
   * ```
   */
  getPrimaryDisplay(): { readonly workArea: Rectangle };
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
   * @param options Whether to start a runtime when none runs and whether to take over another build's runtime; both
   * by default.
   * @returns A promise of the connection.
   * @throws RuntimeHandoverException, PreShellDataFoundException, WorkInProgressException, LaunchException, ConnectionException
   * or, when it may not start one, NoRuntimeException as a rejection, as `RuntimeLauncher.attachAsync` does.
   * @example
   * ```ts
   * import type { IRuntimeConnection, IRuntimeLauncher } from "@noldova/teamrun-shell-desktop";
   *
   * export function attachAsync(launcher: IRuntimeLauncher): Promise<IRuntimeConnection> {
   *   return launcher.attachAsync("desktop", { onEvent: () => undefined, onDisconnected: () => undefined });
   * }
   * ```
   */
  attachAsync(clientName: string, listener: IRuntimeClientListener, policy?: StopPolicy, options?: AttachOptions): Promise<IRuntimeConnection>;

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
   * Gives up the single-instance lock, so that the copy a desktop started from a terminal starts of itself can claim
   * it.
   *
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function release(app: IApplicationHost): void {
   *   app.releaseSingleInstanceLock();
   * }
   * ```
   */
  releaseSingleInstanceLock(): void;

  /**
   * Lists the operating system's preferred languages, most preferred first.
   *
   * @returns Language tags such as `en-US` or `de`.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function firstLanguage(app: IApplicationHost): string | undefined {
   *   return app.getPreferredSystemLanguages()[0];
   * }
   * ```
   */
  getPreferredSystemLanguages(): string[];

  /**
   * Tells whether the application runs from an Applications folder, which only macOS has.
   *
   * @returns `true` when it does.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function mustMove(app: IApplicationHost): boolean {
   *   return !app.isInApplicationsFolder();
   * }
   * ```
   */
  isInApplicationsFolder(): boolean;

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
   * Starts the application again once this instance exits, with the same command line.
   *
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function restart(app: IApplicationHost): void {
   *   app.relaunch();
   *   app.exit(0);
   * }
   * ```
   */
  relaunch(): void;

  /**
   * Exits at once, without closing the windows or asking them first.
   *
   * @param exitCode The process's exit code.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function end(app: IApplicationHost): void {
   *   app.exit(0);
   * }
   * ```
   */
  exit(exitCode: number): void;

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

  /**
   * Listens for the last window closing.
   *
   * @param event The event's name.
   * @param listener Called each time the last window closes.
   * @returns Electron's own return value, which the desktop does not use.
   */
  on(event: "window-all-closed", listener: () => void): unknown;

  /**
   * Listens for the application being activated, as macOS does when its Dock icon is clicked.
   *
   * @param event The event's name.
   * @param listener Called on each activation.
   * @returns Electron's own return value, which the desktop does not use.
   */
  on(event: "activate", listener: () => void): unknown;

  /**
   * Listens for the application being about to quit, after its windows have closed.
   *
   * @param event The event's name.
   * @param listener Called once the application is about to quit.
   * @returns Electron's own return value, which the desktop does not use.
   */
  on(event: "will-quit", listener: () => void): unknown;

  /**
   * Listens for a request to quit, before any window closes; preventing the event keeps the application running.
   *
   * @param event The event's name.
   * @param listener Called with the event each time the application is asked to quit.
   * @returns Electron's own return value, which the desktop does not use.
   */
  on(event: "before-quit", listener: (event: IPreventableEvent) => void): unknown;
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
 * Turns spell checking on and off and chooses its dictionaries, as an Electron session provides it.
 */
export interface ISpellCheckHost {
  /**
   * Turns spell checking on or off for every window of the session.
   *
   * @param isEnabled Whether misspelled words are marked.
   * @example
   * ```ts
   * import type { ISpellCheckHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function stopChecking(host: ISpellCheckHost): void {
   *   host.setSpellCheckerEnabled(false);
   * }
   * ```
   */
  setSpellCheckerEnabled(isEnabled: boolean): void;

  /**
   * Chooses the languages words are checked in. macOS ignores it, because its system checker chooses.
   *
   * @param languages Language tags whose dictionaries the session has, such as `en-US`.
   * @example
   * ```ts
   * import type { ISpellCheckHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function checkInEnglish(host: ISpellCheckHost): void {
   *   host.setSpellCheckerLanguages(["en-US"]);
   * }
   * ```
   */
  setSpellCheckerLanguages(languages: string[]): void;

  /**
   * Sets the address a dictionary that is not in the profile's `Dictionaries` folder would be downloaded from.
   *
   * @param url The address, ending in `/`.
   * @example
   * ```ts
   * import type { ISpellCheckHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function downloadNothing(host: ISpellCheckHost): void {
   *   host.setSpellCheckerDictionaryDownloadURL("file:///home/ada/.teamrun/desktop/Dictionaries/");
   * }
   * ```
   */
  setSpellCheckerDictionaryDownloadURL(url: string): void;

  /**
   * Adds a word to the session's dictionary, so it is no longer marked. On Linux that dictionary is the profile's own
   * file; with the Windows or macOS system checker it is the system's user dictionary, which other applications share.
   *
   * @param word The word to add.
   * @returns Whether the session took the word.
   * @example
   * ```ts
   * import type { ISpellCheckHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function learn(host: ISpellCheckHost): boolean {
   *   return host.addWordToSpellCheckerDictionary("TeamRun");
   * }
   * ```
   */
  addWordToSpellCheckerDictionary(word: string): boolean;
}

/**
 * Electron's `session` module, as far as the desktop uses it.
 */
export interface ISessionHost {
  /**
   * The session the window's web contents use.
   */
  readonly defaultSession: IPermissionHost & ISpellCheckHost;
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
 * Opens files, folders and links in the system's own application, as Electron's `shell` provides it.
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

  /**
   * Opens a link in the system's own application, such as a web page in the browser.
   *
   * @param url The link to open, one that `LinkPolicy.findAllowed` allowed.
   * @returns A promise that settles once the system has taken the link.
   * @throws Error asynchronously when the system cannot open it.
   * @example
   * ```ts
   * import type { IShellHost } from "@noldova/teamrun-shell-desktop";
   *
   * export async function openDocsAsync(host: IShellHost): Promise<void> {
   *   await host.openExternal("https://example.com/docs");
   * }
   * ```
   */
  openExternal(url: string): Promise<void>;
}

/**
 * What Electron reports about a right click or a context menu key in a page, as far as the desktop uses it.
 */
export interface IContextMenuParams {
  /**
   * The horizontal position of the menu in the page, in CSS pixels.
   */
  readonly x: number;

  /**
   * The vertical position of the menu in the page, in CSS pixels.
   */
  readonly y: number;

  /**
   * The misspelled word under the menu, or empty when there is none.
   */
  readonly misspelledWord: string;

  /**
   * The spell checker's suggestions for the misspelled word, best first.
   */
  readonly dictionarySuggestions: string[];

  /**
   * What asked for the menu, such as `mouse` or `keyboard`.
   */
  readonly menuSourceType: string;
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

  /**
   * Listens for a redirect during a navigation, which the listener may cancel.
   *
   * @param event The event's name.
   * @param listener Receives the cancellable event and the URL the redirect leads to.
   * @returns Electron's own return value, which the desktop does not use.
   */
  on(event: "will-redirect", listener: (event: IPreventableEvent, url: string) => void): unknown;

  /**
   * Listens for a webview being attached to the page, which the listener may cancel.
   *
   * @param event The event's name.
   * @param listener Receives the cancellable event.
   * @returns Electron's own return value, which the desktop does not use.
   */
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
   * Listens for the page asking for a context menu, which Electron reports only when the page did not cancel the
   * request.
   *
   * @param event The event's name.
   * @param listener Receives Electron's event and what it reports about the menu.
   * @returns Electron's own return value, which the desktop does not use.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/teamrun-shell-desktop";
   *
   * export function follow(contents: IWindowContents, words: string[]): void {
   *   contents.on("context-menu", (_event, params) => words.push(params.misspelledWord));
   * }
   * ```
   */
  on(event: "context-menu", listener: (event: unknown, params: IContextMenuParams) => void): unknown;

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
   * Replaces the misspelled word around the page's selection, as one step that Undo reverts.
   *
   * @param text The replacement.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/teamrun-shell-desktop";
   *
   * export function correct(contents: IWindowContents): void {
   *   contents.replaceMisspelling("world");
   * }
   * ```
   */
  replaceMisspelling(text: string): void;

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
   * Listens for the operating system showing the notification.
   *
   * @param event `"show"`.
   * @param listener Called once it shows.
   * @returns Electron's notification, for chaining.
   * @example
   * ```ts
   * import type { ISystemNotification } from "@noldova/teamrun-shell-desktop";
   *
   * export function whenShown(notification: ISystemNotification): Promise<void> {
   *   return new Promise(resolve => notification.on("show", resolve));
   * }
   * ```
   */
  on(event: "show", listener: () => void): unknown;

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
 * An icon in the Windows notification area, the macOS menu bar or the Linux tray, as Electron's `Tray` provides it.
 */
export interface ITray {
  /**
   * Shows another image.
   *
   * @param image The image file: `.ico` on Windows, a template `.png` on macOS, `.png` on Linux.
   * @example
   * ```ts
   * import type { ITray } from "@noldova/teamrun-shell-desktop";
   *
   * export function showIdle(tray: ITray): void {
   *   tray.setImage("/teamrun/assets/icons/tray/tray-idle.png");
   * }
   * ```
   */
  setImage(image: string): void;

  /**
   * Sets the text shown when the pointer rests on the icon.
   *
   * @param toolTip The text.
   * @example
   * ```ts
   * import type { ITray } from "@noldova/teamrun-shell-desktop";
   *
   * export function describe(tray: ITray): void {
   *   tray.setToolTip("TeamRun: 2 running");
   * }
   * ```
   */
  setToolTip(toolTip: string): void;

  /**
   * Sets the icon's menu.
   *
   * @param menu A menu that {@link IMenuHost.buildFromTemplate} built.
   * @example
   * ```ts
   * import type { IMenuHost, ITray } from "@noldova/teamrun-shell-desktop";
   *
   * export function offerQuit(tray: ITray, menu: IMenuHost, quit: () => void): void {
   *   tray.setContextMenu(menu.buildFromTemplate([{ label: "Quit TeamRun", click: quit }]));
   * }
   * ```
   */
  setContextMenu(menu: unknown): void;

  /**
   * Listens for a click on the icon.
   *
   * @param event `click`.
   * @param listener Called on each click.
   * @returns The tray, for chaining.
   * @example
   * ```ts
   * import type { ITray } from "@noldova/teamrun-shell-desktop";
   *
   * export function openOnClick(tray: ITray, open: () => void): void {
   *   tray.on("click", open);
   * }
   * ```
   */
  on(event: "click", listener: () => void): unknown;

  /**
   * Removes the icon.
   *
   * @example
   * ```ts
   * import type { ITray } from "@noldova/teamrun-shell-desktop";
   *
   * export function hide(tray: ITray): void {
   *   tray.destroy();
   * }
   * ```
   */
  destroy(): void;
}

/**
 * Creates tray icons, as Electron's `Tray` constructor does.
 */
export interface ITrayHost {
  /**
   * Shows a new icon.
   *
   * @param image The icon's image file.
   * @returns The icon.
   * @throws Error when the operating system cannot show it.
   * @example
   * ```ts
   * import type { ITray, ITrayHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function show(host: ITrayHost): ITray {
   *   return host.create("/teamrun/assets/icons/tray/tray-idle.png");
   * }
   * ```
   */
  create(image: string): ITray;
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
   * Shows a message box on a window, or on its own when the window is gone or none is given.
   *
   * @param windowId The window's id, or null for a box of its own.
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
  showMessageBox(windowId: number | null, options: MessageBoxOptions): Promise<MessageBoxReturnValue>;
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
   *   window.setTitleBarOverlay({ color: "#181818", symbolColor: "#CCCCCC", height: 32 });
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
   *   window.setAppDetails(TaskbarIdentity.create(true, "/opt/teamrun/teamrun", "", "", [], "/opt/teamrun").toAppDetails());
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

  /**
   * Listens for the window having been resized.
   *
   * @param event The event's name.
   * @param listener Called after each resize.
   * @returns Electron's own return value, which the desktop does not use.
   */
  on(event: "resize", listener: () => void): unknown;

  /**
   * Listens for the window having been moved.
   *
   * @param event The event's name.
   * @param listener Called after each move.
   * @returns Electron's own return value, which the desktop does not use.
   */
  on(event: "move", listener: () => void): unknown;

  /**
   * Listens for the window being about to move.
   *
   * @param event The event's name.
   * @param listener Called before each move.
   * @returns Electron's own return value, which the desktop does not use.
   */
  on(event: "will-move", listener: () => void): unknown;

  /**
   * Listens for the window being about to be resized.
   *
   * @param event The event's name.
   * @param listener Called before each resize.
   * @returns Electron's own return value, which the desktop does not use.
   */
  on(event: "will-resize", listener: () => void): unknown;

  /**
   * Listens for the window being maximized.
   *
   * @param event The event's name.
   * @param listener Called each time the window is maximized.
   * @returns Electron's own return value, which the desktop does not use.
   */
  on(event: "maximize", listener: () => void): unknown;

  /**
   * Listens for the window being restored from maximized.
   *
   * @param event The event's name.
   * @param listener Called each time the window leaves the maximized state.
   * @returns Electron's own return value, which the desktop does not use.
   */
  on(event: "unmaximize", listener: () => void): unknown;

  /**
   * Listens for the window's page no longer responding.
   *
   * @param event The event's name.
   * @param listener Called each time the page stops responding.
   * @returns Electron's own return value, which the desktop does not use.
   */
  on(event: "unresponsive", listener: () => void): unknown;

  /**
   * Listens for the window's page responding again after it stopped.
   *
   * @param event The event's name.
   * @param listener Called each time the page responds again.
   * @returns Electron's own return value, which the desktop does not use.
   */
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
 * The file operations {@link PathCommand} links the command with, as Node.js's `fs/promises` provides them.
 */
export interface IPathCommandFiles {
  /**
   * Reads a file's own status, without following a link.
   *
   * @param file The file to read.
   * @returns Its status; rejects with an error whose `code` is `ENOENT` when nothing is there.
   * @example
   * ```ts
   * import type { IPathCommandFiles } from "@noldova/teamrun-shell-desktop";
   *
   * export async function isLinkAsync(files: IPathCommandFiles, file: string): Promise<boolean> {
   *   return (await files.lstat(file)).isSymbolicLink();
   * }
   * ```
   */
  lstat(file: string): Promise<Stats>;

  /**
   * Reads where a link points.
   *
   * @param link The link to read.
   * @returns The path it points to.
   * @example
   * ```ts
   * import type { IPathCommandFiles } from "@noldova/teamrun-shell-desktop";
   *
   * export function targetAsync(files: IPathCommandFiles): Promise<string> {
   *   return files.readlink("/usr/local/bin/teamrun");
   * }
   * ```
   */
  readlink(link: string): Promise<string>;

  /**
   * Removes a file or a link.
   *
   * @param file The file to remove.
   * @returns A promise that settles once it is removed.
   * @example
   * ```ts
   * import type { IPathCommandFiles } from "@noldova/teamrun-shell-desktop";
   *
   * export function unlinkAsync(files: IPathCommandFiles): Promise<void> {
   *   return files.rm("/usr/local/bin/teamrun");
   * }
   * ```
   */
  rm(file: string): Promise<void>;

  /**
   * Makes a folder and any folders above it that are missing.
   *
   * @param folder The folder to make.
   * @param options Always recursive.
   * @returns The first folder it made, or `undefined` when all were there.
   * @example
   * ```ts
   * import type { IPathCommandFiles } from "@noldova/teamrun-shell-desktop";
   *
   * export async function prepareAsync(files: IPathCommandFiles): Promise<void> {
   *   await files.mkdir("/usr/local/bin", { recursive: true });
   * }
   * ```
   */
  mkdir(folder: string, options: { readonly recursive: true }): Promise<string | undefined>;

  /**
   * Makes a link.
   *
   * @param target The path the link points to.
   * @param link The link to make.
   * @returns A promise that settles once the link is made; rejects with an error whose `code` of `EACCES` or `EPERM`
   * makes {@link PathCommand.installAsync} ask for an administrator.
   * @example
   * ```ts
   * import type { IPathCommandFiles } from "@noldova/teamrun-shell-desktop";
   *
   * export function linkAsync(files: IPathCommandFiles): Promise<void> {
   *   return files.symlink("/Applications/TeamRun.app/Contents/Resources/bin/teamrun", "/usr/local/bin/teamrun");
   * }
   * ```
   */
  symlink(target: string, link: string): Promise<void>;
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
   * @param options The utility process's standard streams, the name it shows in task managers, its environment and,
   * when given, the folder it starts in, which the program it starts inherits.
   * @returns The utility process.
   * @example
   * ```ts
   * import type { IUtilityProcess, IUtilityProcessHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function start(host: IUtilityProcessHost, script: string): IUtilityProcess {
   *   return host.fork(script, [], { stdio: "ignore", serviceName: "Example", env: process.env });
   * }
   * ```
   */
  fork(modulePath: string, args: string[], options: { stdio: "ignore"; serviceName: string; env: NodeJS.ProcessEnv; cwd?: string }): IUtilityProcess;
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
   * The system's file manager and browser, for opening the log folder and links.
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
   * The tray, for the icon in the Windows notification area, the macOS menu bar or the Linux tray.
   */
  readonly tray: ITrayHost;

  /**
   * Electron's `autoUpdater`, Squirrel.Mac on macOS, which installs a staged update as the desktop quits.
   */
  readonly nativeUpdater: INativeUpdater;

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
   * The exception's name, `"DeviceIdentityException"`, which the class sets itself so
   * that a minified build keeps it.
   */
  public override readonly name: string;

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
   * Makes the area of a rectangle, such as a display's work area.
   *
   * @param rectangle The rectangle.
   * @returns The area.
   * @example
   * ```ts
   * import { ScreenArea } from "@noldova/teamrun-shell-desktop";
   *
   * export const area: ScreenArea = ScreenArea.of({ x: 0, y: 25, width: 1024, height: 743 });
   * ```
   */
  public static of(rectangle: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }): ScreenArea;

  /**
   * Counts the pixels a rectangle shares with the area.
   *
   * @param x The rectangle's left edge.
   * @param y The rectangle's top edge.
   * @param width The rectangle's width.
   * @param height The rectangle's height.
   * @returns The number of shared pixels, 0 when the rectangle does not overlap the area.
   * @example
   * ```ts
   * import { ScreenArea } from "@noldova/teamrun-shell-desktop";
   *
   * export const shared: number = new ScreenArea(0, 0, 1920, 1040).overlapArea(1900, 100, 800, 600);
   * ```
   */
  public overlapArea(x: number, y: number, width: number, height: number): number;

  /**
   * Tells whether a size fits in the area.
   *
   * @param width The width.
   * @param height The height.
   * @returns `true` when neither side is larger than the area's.
   * @example
   * ```ts
   * import { ScreenArea } from "@noldova/teamrun-shell-desktop";
   *
   * export const fits: boolean = new ScreenArea(0, 25, 1024, 743).fits(1280, 800);
   * ```
   */
  public fits(width: number, height: number): boolean;
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
   * The state while TeamRun saves the window's work and closes for an update.
   *
   * @param version The version being installed.
   * @returns The state.
   * @example
   * ```ts
   * import { StartupState } from "@noldova/teamrun-shell-desktop";
   *
   * export const state: StartupState = StartupState.updating("0.3.0");
   * ```
   */
  public static updating(version: string): StartupState;

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
   * export const appearance: WindowAppearance = new WindowAppearance("#181818", "#181818", "#CCCCCC", 32);
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
   * export const appearance: WindowAppearance = WindowAppearance.fromJson({ background: "#F8F8F8", titleBar: "#F8F8F8", titleBarText: "#1E1E1E", titleBarHeight: 32 });
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
   * export const message: string = JSON.stringify(new WindowAppearance("#181818", "#181818", "#CCCCCC", 32).toJson());
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
   * @param height The height; an integer of at least the window's minimum height, 480.
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
   * The state of a window that has not been placed yet: 1280 by 800 pixels, but no more than nine tenths of the work area
   * on each side and no less than the minimum size, where the operating system puts it.
   *
   * @param area The work area of the display the window opens on.
   * @returns The default state.
   * @example
   * ```ts
   * import { ScreenArea, WindowState } from "@noldova/teamrun-shell-desktop";
   *
   * export const state: WindowState = WindowState.createDefault(new ScreenArea(0, 25, 1024, 743));
   * ```
   */
  public static createDefault(area: ScreenArea): WindowState;

  /**
   * Reads a saved state, growing a size below the window's minimum to it.
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
   * Places the state's bounds on the connected displays. Bounds that a display shows and that fit its work area are kept,
   * on the display that shows most of them. Otherwise the window is centered on that display, or on the primary display
   * when no display shows it or it has no position; a size that fits the work area is kept, and a larger one shrinks to no
   * more than nine tenths of the work area on each side.
   *
   * @param workAreas The work areas of the connected displays.
   * @param primary The work area of the primary display.
   * @returns The bounds to apply.
   * @example
   * ```ts
   * import { ScreenArea, WindowState } from "@noldova/teamrun-shell-desktop";
   *
   * const primary: ScreenArea = new ScreenArea(0, 0, 1920, 1040);
   * export const bounds: ScreenArea = new WindowState(3000, 100, 1280, 800, false).placeOn([primary], primary);
   * ```
   */
  public placeOn(workAreas: readonly ScreenArea[], primary: ScreenArea): ScreenArea;

  /**
   * Writes the state for saving.
   *
   * @returns The state as JSON.
   * @example
   * ```ts
   * import { ScreenArea, WindowState } from "@noldova/teamrun-shell-desktop";
   *
   * export const saved: string = JSON.stringify(WindowState.createDefault(new ScreenArea(0, 0, 1920, 1040)).toJson());
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
 * Asks in the window where an update began whether to wait for the work in progress or to stop it, listing the work by
 * data directory. Waiting keeps the list current, reading the work again every interval, and goes on once none is
 * left; Cancel, or a window that can no longer ask, ends the update with nothing changed.
 */
export declare class UpdateWorkQuestion {
  /**
   * Creates the question.
   *
   * @param prompt The window that asks.
   * @param readWorkAsync Reads the work again while the person waits; a runtime that has gone leaves the list.
   * @param interval How long to wait between readings of the work, in milliseconds.
   * @param wait Resolves after the given number of milliseconds, or rejects when the signal aborts.
   * @example
   * ```ts
   * import { setTimeout as delay } from "node:timers/promises";
   *
   * import { type IQuitPrompt, UpdateWorkQuestion } from "@noldova/teamrun-shell-desktop";
   *
   * export function create(prompt: IQuitPrompt, readWorkAsync: () => Promise<readonly string[]>): UpdateWorkQuestion {
   *   return new UpdateWorkQuestion(prompt, readWorkAsync, 1000, (t, signal) => delay(t, undefined, { signal }));
   * }
   * ```
   */
  public constructor(prompt: IQuitPrompt, readWorkAsync: () => Promise<readonly string[]>, interval: number, wait: (milliseconds: number, signal: AbortSignal) => Promise<void>);

  /**
   * Shows the question and settles with the person's choice. It asks once; withdraws the question when it settles.
   *
   * @param work The work in progress, each named with its data directory.
   * @returns A promise of the work the person agreed to stop: the list shown when they chose Stop, or empty when they
   * waited until none was left, which agrees to nothing; `null` when they cancelled.
   * @throws Error Rejected with the error of a reading that fails while the person waits.
   * @example
   * ```ts
   * import type { UpdateWorkQuestion } from "@noldova/teamrun-shell-desktop";
   *
   * export function askAsync(question: UpdateWorkQuestion): Promise<readonly string[] | null> {
   *   return question.askAsync(["Indexing the project (/work/data)"]);
   * }
   * ```
   */
  public askAsync(work: readonly string[]): Promise<readonly string[] | null>;

  /**
   * Takes the person's choice from the window that asks.
   *
   * @param prompt The window that answered.
   * @param choice `Wait`, `Stop` or `Cancel`.
   * @returns `true` when the answer was taken; `false` for another window, an unknown choice, a second Wait or a
   * question already settled.
   * @example
   * ```ts
   * import { type IQuitPrompt, QuitChoice, type UpdateWorkQuestion } from "@noldova/teamrun-shell-desktop";
   *
   * export function stop(question: UpdateWorkQuestion, prompt: IQuitPrompt): boolean {
   *   return question.answer(prompt, QuitChoice.Stop);
   * }
   * ```
   */
  public answer(prompt: IQuitPrompt, choice: unknown): boolean;
}

/**
 * Asks one window to save before TeamRun stops for an update, and collects what did not save: a window that is gone
 * or does not answer in time counts as not saved, since an update is never worth an unsaved change.
 */
export declare class UpdateSaveCoordinator {
  /**
   * Creates the coordinator.
   *
   * @param send Sends a save request with its id to the window; returns `false` when the window is gone.
   * @param timeout How long to wait for an answer, in milliseconds; a positive integer.
   * @throws ArgumentOutOfRangeException synchronously when the timeout is not a positive integer.
   * @example
   * ```ts
   * import { UpdateSaveCoordinator } from "@noldova/teamrun-shell-desktop";
   *
   * export const coordinator: UpdateSaveCoordinator = new UpdateSaveCoordinator(() => true, 5000);
   * ```
   */
  public constructor(send: (requestId: string) => boolean, timeout: number);

  /**
   * Asks the window to save.
   *
   * @param window The window's number among the desktop's open windows, from 1, which names it when it is gone or
   * does not answer.
   * @returns A promise of what did not save: the window's own list, or one problem naming the window when it is gone
   * or did not answer in time; empty when everything saved.
   * @example
   * ```ts
   * import { UpdateSaveCoordinator } from "@noldova/teamrun-shell-desktop";
   *
   * const coordinator = new UpdateSaveCoordinator(t => coordinator.answer(t, []), 5000);
   * export const problems: readonly string[] = await coordinator.requestAsync(1);
   * ```
   */
  public requestAsync(window: number): Promise<readonly string[]>;

  /**
   * Takes the window's answer to a request.
   *
   * @param requestId The request's id, as the window sent it.
   * @param problems What the window could not save, as text.
   * @returns `true` when the answer settled a waiting request; `false` for an unknown or late id or a malformed answer.
   * @example
   * ```ts
   * import { UpdateSaveCoordinator } from "@noldova/teamrun-shell-desktop";
   *
   * export const isAccepted: boolean = new UpdateSaveCoordinator(() => true, 5000).answer("unknown", []);
   * ```
   */
  public answer(requestId: unknown, problems: unknown): boolean;

  /**
   * Settles every waiting request as not saved, as when the window is gone.
   *
   * @example
   * ```ts
   * import { UpdateSaveCoordinator } from "@noldova/teamrun-shell-desktop";
   *
   * new UpdateSaveCoordinator(() => true, 5000).release();
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
   * Asks the page to save before TeamRun stops for an update.
   */
  public readonly updateSaves: UpdateSaveCoordinator;

  /**
   * Restores and keeps the window's bounds.
   */
  public readonly bounds: WindowBoundsKeeper;

  /**
   * Limits how many errors from the window's page reach the desktop log: ten a minute, then one notice.
   */
  public readonly errors: WindowErrorLimit;

  /**
   * Takes charge of a window that is not yet shown.
   *
   * @param window The window, created hidden.
   * @param displays The displays, for placing restored bounds.
   * @param log Records why a window was shown unpainted and saves that failed.
   * @param guard Decides whether the window may close, or quits TeamRun instead.
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
   *   return open.show(new QuitQuestion(["Indexing the project"], false, false));
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
   * Waits until the page has painted, or the window was shown unpainted.
   *
   * @returns A promise of `true` then, or `false` when the window closed first.
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function readyAsync(open: OpenWindow): Promise<boolean> {
   *   return open.whenPaintedAsync();
   * }
   * ```
   */
  public whenPaintedAsync(): Promise<boolean>;

  /**
   * Asks the page to save, as closing does, then saves the window's bounds. A page that has crashed counts as saved
   * at once, and so does one that does not answer within five seconds.
   *
   * @returns A promise of whether the page saved; a failed bounds save is logged and does not count.
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function saveAsync(open: OpenWindow): Promise<boolean> {
   *   return open.saveAsync();
   * }
   * ```
   */
  public saveAsync(): Promise<boolean>;

  /**
   * Closes the window at once, without its guard or another save, because TeamRun is exiting.
   *
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/teamrun-shell-desktop";
   *
   * export function exit(open: OpenWindow): void {
   *   open.closeNow();
   * }
   * ```
   */
  public closeNow(): void;

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
 * Checks the installation's launch barrier when the desktop starts, before it opens a window. While another desktop
 * holds the barrier, it tells the person with the operating system's message box that TeamRun is installing an update,
 * and the desktop exits. A barrier whose holder is gone after a handoff to another version may mean an installer is
 * still running, so it asks the person and removes the barrier only when they choose to open TeamRun. A barrier left
 * before the handoff is removed silently, and the desktop's log says so.
 */
export declare class UpdateBarrierGate {
  /**
   * Creates the gate.
   *
   * @param installation The installation whose launch barrier it checks.
   * @param productVersion The desktop's product version, which settles a barrier handed off to it.
   * @param dialog Shows the operating system's message box.
   * @param log Writes a line to the desktop's log.
   * @example
   * ```ts
   * import { type IDialogHost, UpdateBarrierGate } from "@noldova/teamrun-shell-desktop";
   * import type { Installation } from "@noldova/teamrun-shell-runtime";
   *
   * export function create(installation: Installation, dialog: IDialogHost): UpdateBarrierGate {
   *   return new UpdateBarrierGate(installation, "0.2.0", dialog, t => console.log(t));
   * }
   * ```
   */
  public constructor(installation: Pick<Installation, "readAsync" | "readTextAsync" | "checkAsync" | "removeAsync">, productVersion: string, dialog: IDialogHost, log: (text: string) => void);

  /**
   * Checks the barrier and, when it holds, asks as {@link askAsync} does. A barrier that cannot be read lets the
   * desktop start, and the runtime's launch reports it.
   *
   * @returns A promise of `true` when the desktop may start, `false` when it exits.
   * @throws Error Rejected when the message box fails or the barrier cannot be removed.
   * @example
   * ```ts
   * import type { UpdateBarrierGate } from "@noldova/teamrun-shell-desktop";
   *
   * export async function startAsync(gate: UpdateBarrierGate, open: () => void): Promise<void> {
   *   if (await gate.passAsync())
   *     open();
   * }
   * ```
   */
  public passAsync(): Promise<boolean>;

  /**
   * Tells the person what a barrier means: `Held` shows that TeamRun is installing an update, with OK; `Unfinished`
   * asks with Quit, the default, and Open TeamRun; `None` asks nothing. Open TeamRun reads and judges the barrier
   * again, since the person may have taken minutes, and removes it only while it is unchanged: a barrier that holds
   * by then is reported as `Held` is, and one that replaced it is judged in turn. When it cannot be removed, the
   * desktop's log says why and an error box tells the person that TeamRun will quit.
   *
   * @param status What the barrier means for this installation.
   * @returns A promise of `true` when the desktop may start, `false` when it exits.
   * @throws Error Rejected when a message box fails.
   * @example
   * ```ts
   * import type { UpdateBarrierGate } from "@noldova/teamrun-shell-desktop";
   * import { UpdateBarrierStatus } from "@noldova/teamrun-shell-runtime";
   *
   * export function askAsync(gate: UpdateBarrierGate): Promise<boolean> {
   *   return gate.askAsync(UpdateBarrierStatus.Unfinished);
   * }
   * ```
   */
  public askAsync(status: UpdateBarrierStatus): Promise<boolean>;
}

/**
 * Ends the desktop when its main process fails with an exception it does not catch or a rejection it does not handle,
 * because its state can no longer be trusted. It records each failure with its stack and asks once, with a native
 * message box of its own, whether to restart the application or quit, exiting with 0 either way; the log folder opens on
 * request and the box asks again. Until the desktop log and its folder are attached, records go redacted to standard
 * error and the box offers only restarting or quitting. Restarting relaunches the application and exits; quitting exits.
 * Both exit at once, without the windows' close guard or the quit question, which would run through the failed process;
 * work in the runtime goes on. A box that cannot be shown is recorded, and the application exits with 1.
 */
export declare class MainProcessRecovery {
  /**
   * Prepares the recovery, before anything else the desktop does; the desktop passes each failure to
   * {@link MainProcessRecovery.receive}.
   *
   * @param app Waits until the application is ready, relaunches it and exits.
   * @param dialog Shows the message box.
   * @param errorOutput Receives the records until a log is attached.
   * @param redactor Redacts those records.
   * @example
   * ```ts
   * import { type IApplicationHost, type IDesktopProcess, type IDialogHost, MainProcessFailureKind, MainProcessRecovery } from "@noldova/teamrun-shell-desktop";
   * import { DiagnosticRedactor } from "@noldova/teamrun-shell-runtime";
   *
   * export function install(app: IApplicationHost, dialog: IDialogHost, desktop: IDesktopProcess): MainProcessRecovery {
   *   const recovery = new MainProcessRecovery(app, dialog, desktop.errorOutput, new DiagnosticRedactor(desktop.homeFolder));
   *   desktop.onUncaughtException(error => recovery.receive(error, MainProcessFailureKind.UncaughtException));
   *   desktop.onUnhandledRejection(reason => recovery.receive(reason, MainProcessFailureKind.UnhandledRejection));
   *   return recovery;
   * }
   * ```
   */
  public constructor(app: IApplicationHost, dialog: IDialogHost, errorOutput: Writable, redactor: DiagnosticRedactor);

  /**
   * Records later failures and choices in the desktop log, and offers its folder in the box.
   *
   * @param log The desktop log.
   * @param openLogFolderAsync Opens the log folder; its promise tells whether it opened.
   * @example
   * ```ts
   * import type { IDesktopLog, MainProcessRecovery } from "@noldova/teamrun-shell-desktop";
   *
   * export function attach(recovery: MainProcessRecovery, log: IDesktopLog): void {
   *   recovery.attach(log, () => Promise.resolve(true));
   * }
   * ```
   */
  public attach(log: IDesktopLog, openLogFolderAsync: () => Promise<boolean>): void;

  /**
   * Records a failure and, for the first one, asks the person whether to restart or quit. The box shows the message
   * of an {@link UnusableFolderException} before its advice.
   *
   * @param error The error or the rejection's reason, recorded with its stack.
   * @param kind How the main process failed.
   * @example
   * ```ts
   * import { MainProcessFailureKind, type MainProcessRecovery } from "@noldova/teamrun-shell-desktop";
   *
   * export function fail(recovery: MainProcessRecovery): void {
   *   recovery.receive(new Error("The main process failed."), MainProcessFailureKind.UncaughtException);
   * }
   * ```
   */
  public receive(error: unknown, kind: MainProcessFailureKind): void;
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
 * theme, or unpainted after ten seconds, and closes once the page has saved. Closing the last window quits it, except
 * on macOS and while its tray icon shows, where it keeps running and says so once on the device; a quit saves every
 * window before it asks the runtime to stop. It records its diagnostics in `logs/desktop.log` once the data directory
 * is usable, and on standard error.
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
   * @param createLauncher Creates the runtime launcher for the chosen settings and the installation, in the device folder, that the desktop's program belongs to.
   * @param readDeviceAsync Reads this device's identity from a folder: the one `--device-dir=` in the process's
   * arguments gives, otherwise the operating system's local application data. A failure leaves window bounds unkept.
   * @param createDeviceFile Creates the store of one of this device's files in the same folder: `appearance.json`, the
   * last appearance preferences, which the desktop reads before it opens a window, so the window's first frame already
   * has them, and keeps as the window reports them; and `device-state.json`, which records the one-time hints the
   * device has shown and the value of `shell.trayIcon` the desktop follows, so the icon starts from it.
   * @param createPathCommand Creates the service that links the command line on the macOS PATH for the program the
   * desktop runs from; the window's "Install command in PATH" command runs it and shows what happened.
   * @param recordDesktopAsync Records this desktop in its installation, as {@link DesktopRecord.recordAsync} does, while
   * the desktop checks the launch barrier, so an update waits for it to quit. A desktop it could not record is logged
   * and starts anyway.
   * @param createUpdater Creates the updater of the installation and the handoff of its platform, given whether the
   * desktop runs from a packaged build and the data directory's `logs` folder for the handoff's programs, or gives
   * `null` for a build that names no update feed, whose updates stay Off; the updater's log is the desktop's. The
   * {@link UpdateController} it drives keeps `update-ready.json` in the installation's folder, follows
   * `shell.updateChecks`, pushes each state on `teamrun:updateState` and posts `shell.updateReady` once over the runtime
   * connection. Before the updater starts, the handoff removes what an earlier one left. Restart to update runs an
   * {@link UpdateStop} that connects through an {@link UpdateTargetConnector}, asks section 9's question in a window
   * through an {@link UpdateWorkQuestion} and calls the handoff, with an {@link AppImageRestart} on Linux; a quit asked
   * for meanwhile waits until the handoff has finished or failed. Once the handoff has succeeded, and only then, the
   * desktop quits without asking anything again: on macOS it closes its windows and calls
   * `nativeUpdater.quitAndInstall`, so the new version starts, and elsewhere it exits at once. When Squirrel reports an
   * `error`, or macOS hasn't quit within 10 seconds, the desktop logs it, tells the person that macOS installs the
   * update but TeamRun can't open again by itself, and exits.
   * @param createUpdateLock Creates the lock that lets one desktop of the installation check at a time; the lock's log
   * is the desktop's.
   * @example
   * ```ts
   * import { ProcessPresence, RuntimeBuild, RuntimeLauncher, SystemCommand } from "@noldova/teamrun-shell-runtime";
   * import { DesktopApplication, DesktopRecord, DeviceFileStore, DeviceIdentity, type IDesktopProcess, type IElectron, PathCommand, UpdateCheckLock } from "@noldova/teamrun-shell-desktop";
   *
   * export function launch(electron: IElectron, process: IDesktopProcess): void {
   *   DesktopApplication.start(
   *     electron,
   *     process,
   *     "file:///repository/node_modules/@noldova/teamrun-shell-desktop/main.js",
   *     (settings, installation) => new RuntimeLauncher(settings, RuntimeBuild.identity, installation),
   *     t => DeviceIdentity.readOrCreateAsync(t),
   *     (folder, fileName) => new DeviceFileStore(folder, fileName),
   *     t => PathCommand.forBundle(t, () => Promise.resolve()),
   *     t => DesktopRecord.recordAsync(t, ProcessPresence.create(process.platform, new SystemCommand()), process.processId),
   *     () => null,
   *     (t, log) => new UpdateCheckLock(t.folder, () => Promise.resolve(null), () => Promise.resolve(false), log));
   * }
   * ```
   */
  public static start(
    electron: IElectron,
    process: IDesktopProcess,
    moduleUrl: string,
    createLauncher: (settings: LaunchSettings, installation: Installation) => IRuntimeLauncher,
    readDeviceAsync: (folder: string) => Promise<string>,
    createDeviceFile: (folder: string, fileName: string) => IDeviceFileStore,
    createPathCommand: (executablePath: string) => PathCommand,
    recordDesktopAsync: (installation: Installation) => Promise<boolean>,
    createUpdater: (installation: Installation, isPackaged: boolean, logsFolder: string, log: (text: string) => void) => IUpdateSetup | null,
    createUpdateLock: (installation: Installation, log: (text: string) => void) => IUpdateCheckLock): void;
}

/**
 * Records a desktop in its installation, so an update can find it while it has no runtime connection.
 */
export declare class DesktopRecord {
  /**
   * Stamps the desktop's process with its start time and records it in the installation.
   *
   * @param installation The installation the desktop's program belongs to.
   * @param presence Stamps the desktop's process.
   * @param processId The desktop's process id.
   * @returns A promise of whether the desktop was recorded; false when its process is not in the process table.
   * @throws Error Rejected when the process table cannot be read or the record cannot be written.
   * @example
   * ```ts
   * import { type Installation, ProcessPresence, SystemCommand } from "@noldova/teamrun-shell-runtime";
   * import { DesktopRecord } from "@noldova/teamrun-shell-desktop";
   *
   * export function recordAsync(installation: Installation): Promise<boolean> {
   *   return DesktopRecord.recordAsync(installation, ProcessPresence.create(process.platform, new SystemCommand()), process.pid);
   * }
   * ```
   */
  public static recordAsync(installation: Pick<Installation, "recordDesktopAsync">, presence: Pick<ProcessPresence, "stampAsync">, processId: number): Promise<boolean>;
}

/**
 * Quits a desktop that has no runtime connection once another desktop's update reaches `Closing`, so it does not
 * keep running the installation's files through the handoff.
 */
export declare class UpdateBarrierWatch {
  /**
   * Creates the watch.
   *
   * @param updates The desktop's side of an update: its process id, the barrier, whether the update has ended and how
   * to quit.
   * @param isConnected Whether the desktop has a runtime connection, which tells it about an update itself.
   * @param interval How often, in milliseconds, it reads the barrier.
   * @throws ArgumentOutOfRangeException synchronously when the interval is not a positive integer.
   * @example
   * ```ts
   * import { type IUpdateHost, UpdateBarrierWatch } from "@noldova/teamrun-shell-desktop";
   *
   * export function watch(updates: IUpdateHost, isConnected: () => boolean): UpdateBarrierWatch {
   *   return new UpdateBarrierWatch(updates, isConnected, 1000);
   * }
   * ```
   */
  public constructor(updates: Pick<IUpdateHost, "processId" | "readBarrierAsync" | "hasUpdateEndedAsync" | "quit">, isConnected: () => boolean, interval: number);

  /**
   * Starts checking the barrier every interval; starting it again changes nothing.
   *
   * @example
   * ```ts
   * import type { UpdateBarrierWatch } from "@noldova/teamrun-shell-desktop";
   *
   * export function begin(watch: UpdateBarrierWatch): void {
   *   watch.start();
   * }
   * ```
   */
  public start(): void;

  /**
   * Stops checking the barrier.
   *
   * @example
   * ```ts
   * import type { UpdateBarrierWatch } from "@noldova/teamrun-shell-desktop";
   *
   * export function end(watch: UpdateBarrierWatch): void {
   *   watch.stop();
   * }
   * ```
   */
  public stop(): void;

  /**
   * Checks the barrier once, unless the desktop is connected or a check is still running. It quits the desktop, and
   * stops, when the barrier is `Closing` for another desktop whose update has not ended; a barrier it cannot read, or
   * an update it cannot tell has ended, keeps the desktop running.
   *
   * @returns A promise of whether it quit the desktop.
   * @example
   * ```ts
   * import type { UpdateBarrierWatch } from "@noldova/teamrun-shell-desktop";
   *
   * export function checkAsync(watch: UpdateBarrierWatch): Promise<boolean> {
   *   return watch.checkAsync();
   * }
   * ```
   */
  public checkAsync(): Promise<boolean>;
}

/**
 * One JSON object the desktop keeps for this device in a file outside the data directory, such as the last appearance
 * preferences, so the next start has it before it reaches the runtime.
 */
export interface IDeviceFileStore {
  /**
   * Reads the object kept last.
   *
   * @returns A promise of the object, or `null` when none is kept; it rejects when the kept file cannot be read.
   * @example
   * ```ts
   * import type { IDeviceFileStore } from "@noldova/teamrun-shell-desktop";
   *
   * export async function hasAppearanceAsync(store: IDeviceFileStore): Promise<boolean> {
   *   return await store.readAsync() !== null;
   * }
   * ```
   */
  readAsync(): Promise<JsonObject | null>;

  /**
   * Keeps the object, replacing the one kept before; writes happen one at a time, in order.
   *
   * @param value The object to keep.
   * @returns A promise that settles once it is kept.
   * @example
   * ```ts
   * import type { IDeviceFileStore } from "@noldova/teamrun-shell-desktop";
   *
   * export function keepDarkAsync(store: IDeviceFileStore): Promise<void> {
   *   return store.writeAsync({ "shell.mode": "Dark" });
   * }
   * ```
   */
  writeAsync(value: JsonObject): Promise<void>;

  /**
   * Removes the kept object, after any write still in progress; nothing kept is not a failure.
   *
   * @returns A promise that settles once it is removed.
   * @example
   * ```ts
   * import type { IDeviceFileStore } from "@noldova/teamrun-shell-desktop";
   *
   * export function forgetAsync(store: IDeviceFileStore): Promise<void> {
   *   return store.deleteAsync();
   * }
   * ```
   */
  deleteAsync(): Promise<void>;
}

/**
 * Puts the dictionaries that ship with the desktop where Electron's spell checker finds them.
 */
export declare class SpellingDictionaries {
  /**
   * Puts each dictionary the folder's `dictionaries.json` lists into the profile's `Dictionaries` folder, where
   * Electron's spell checker finds it, unless it is already there. It runs before the application is ready, because
   * Electron reads that folder as it becomes ready. A dictionary whose entry is not valid or whose file cannot be copied
   * is left out and logged.
   *
   * @param sourceFolder The folder of the shipped dictionaries.
   * @param profileFolder The profile folder, Electron's `userData`.
   * @param log Receives each line to log.
   * @returns The languages of the dictionaries in the profile, in the list's order; none when the list cannot be read.
   * @example
   * ```ts
   * import { SpellingDictionaries } from "@noldova/teamrun-shell-desktop";
   *
   * export function install(profile: string): readonly string[] {
   *   return SpellingDictionaries.install("/opt/teamrun/assets/dictionaries", profile, line => console.error(line));
   * }
   * ```
   */
  public static install(sourceFolder: string, profileFolder: string, log: (text: string) => void): readonly string[];

  /**
   * Gives the profile's `Dictionaries` folder as a `file:` URL ending in a slash, the address the spell checker gives
   * Chromium for downloads. Chromium cannot download from a `file:` URL, so a missing dictionary fails at once without
   * a connection, and no local process can answer in its place as one listening on a loopback port could.
   *
   * @param profileFolder The profile folder, Electron's `userData`.
   * @returns The folder's `file:` URL with a trailing slash.
   * @example
   * ```ts
   * import { SpellingDictionaries } from "@noldova/teamrun-shell-desktop";
   *
   * export function addressOf(profile: string): string {
   *   return SpellingDictionaries.addressOf(profile);
   * }
   * ```
   */
  public static addressOf(profileFolder: string): string;
}

/**
 * Applies the spelling settings to the window's session. On Windows and Linux it checks only in shipped languages and
 * points the dictionary download address at the profile's own dictionary folder as a `file:` URL, from which Chromium
 * cannot download, so a dictionary is never downloaded; on macOS the system checker chooses the languages and only
 * checking on or off applies.
 */
export declare class SpellChecker {
  /**
   * Creates the spell checker.
   *
   * @param host Gives the session once the application is ready.
   * @param languages The shipped languages in the profile, in their order.
   * @param address The dictionary download address, the profile's own dictionary folder as a `file:` URL, which Chromium cannot download from.
   * @param platform The operating system, as `process.platform` names it.
   * @param readSystemLanguages Lists the operating system's preferred languages.
   * @param log Receives each line to log.
   * @example
   * ```ts
   * import { type ISpellCheckHost, SpellChecker } from "@noldova/teamrun-shell-desktop";
   *
   * export function create(session: ISpellCheckHost): SpellChecker {
   *   return new SpellChecker(() => session, ["en-US"], "file:///home/ada/.teamrun/desktop/Dictionaries/", "linux", () => ["en-US"], line => console.error(line));
   * }
   * ```
   */
  public constructor(host: () => ISpellCheckHost, languages: readonly string[], address: string, platform: string, readSystemLanguages: () => readonly string[], log: (text: string) => void);

  /**
   * Points the dictionary download at the profile's own dictionary folder and checks in the languages an empty choice means, before any window opens.
   *
   * @example
   * ```ts
   * import type { SpellChecker } from "@noldova/teamrun-shell-desktop";
   *
   * export function start(checker: SpellChecker): void {
   *   checker.start();
   * }
   * ```
   */
  public start(): void;

  /**
   * Turns checking on or off and checks in the chosen languages that ship, in their shipped order. With none of them,
   * it checks in the operating system's languages that ship, or else in the first shipped language. A language list
   * the session refuses is logged.
   *
   * @param isChecking Whether misspelled words are marked.
   * @param chosen The chosen language tags.
   * @example
   * ```ts
   * import type { SpellChecker } from "@noldova/teamrun-shell-desktop";
   *
   * export function checkInEnglish(checker: SpellChecker): void {
   *   checker.apply(true, ["en-US"]);
   * }
   * ```
   */
  public apply(isChecking: boolean, chosen: readonly string[]): void;

  /**
   * Adds a word to the session's dictionary on every platform. On Linux that dictionary is TeamRun's own file in the
   * profile; on Windows and macOS it is the system's user dictionary, which other applications share.
   *
   * @param word The word to add.
   * @returns Whether the session took the word.
   * @example
   * ```ts
   * import type { SpellChecker } from "@noldova/teamrun-shell-desktop";
   *
   * export function learn(checker: SpellChecker): boolean {
   *   return checker.addWord("TeamRun");
   * }
   * ```
   */
  public addWord(word: string): boolean;

  /**
   * Describes what the window may offer.
   *
   * @returns `languages`, the shipped languages, none on macOS; and `fallback`, the language an empty choice checks in
   * when none of the operating system's languages ships, or `null`.
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import type { SpellChecker } from "@noldova/teamrun-shell-desktop";
   *
   * export function describe(checker: SpellChecker): JsonObject {
   *   return checker.toJson();
   * }
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Keeps the device's own state in one keyed device file: the one-time hints it has shown, such as where TeamRun went
 * when its last window closed into the tray, and the tray icon setting the desktop follows, written as it changes. It
 * reads the file once and writes one change at a time, so changes never overwrite each other.
 */
export declare class DeviceState {
  /**
   * Creates the state.
   *
   * @param store The device file that holds the state, keyed by name.
   * @param log Records a file that cannot be read or written.
   * @example
   * ```ts
   * import { DeviceFileStore, DeviceState } from "@noldova/teamrun-shell-desktop";
   *
   * export const state: DeviceState = new DeviceState(new DeviceFileStore("/home/person/.local/state/noldova/teamrun", "device-state.json"), console.error);
   * ```
   */
  public constructor(store: IDeviceFileStore, log: (text: string) => void);

  /**
   * Reads the state, from the file the first time and from memory after that. A file that is missing or cannot be read
   * counts as empty.
   *
   * @returns A promise of the state, which never rejects.
   * @example
   * ```ts
   * import type { DeviceState } from "@noldova/teamrun-shell-desktop";
   *
   * export async function readTrayIconAsync(state: DeviceState): Promise<unknown> {
   *   return (await state.readAsync())["trayIcon"];
   * }
   * ```
   */
  public readAsync(): Promise<JsonObject>;

  /**
   * Shows a hint unless this device has shown it before, then records that it has; a hint is tried at most once a
   * run, and one that could not show is not recorded.
   *
   * @param key The hint's name in the state, such as `trayCloseHintShown`.
   * @param showAsync Shows the hint and resolves to whether the operating system showed it.
   * @returns A promise that settles once the hint is recorded or left alone.
   * @example
   * ```ts
   * import type { DeviceState } from "@noldova/teamrun-shell-desktop";
   *
   * export function hintAsync(state: DeviceState): Promise<void> {
   *   return state.showOnceAsync("trayCloseHintShown", () => Promise.resolve(true));
   * }
   * ```
   */
  public showOnceAsync(key: string, showAsync: () => Promise<boolean>): Promise<void>;

  /**
   * Records a value under a key, after any change already being written; a failed write is logged.
   *
   * @param key The value's name in the state, such as `trayIcon`.
   * @param value The value.
   * @returns A promise that settles once the value is written or its failure logged.
   * @example
   * ```ts
   * import type { DeviceState } from "@noldova/teamrun-shell-desktop";
   *
   * export function rememberAsync(state: DeviceState, isShown: boolean): Promise<void> {
   *   return state.rememberAsync("trayIcon", isShown);
   * }
   * ```
   */
  public rememberAsync(key: string, value: JsonValue): Promise<void>;
}

/**
 * Keeps one JSON object in a named file in a device folder, writing a temporary file and renaming it so an interrupted
 * write never leaves a partial file.
 */
export declare class DeviceFileStore implements IDeviceFileStore {
  /**
   * Creates the store.
   *
   * @param folder The device folder.
   * @param fileName The file's name in the folder, such as `appearance.json`.
   * @throws {ArgumentException} When the file name is empty or whitespace.
   * @example
   * ```ts
   * import { DeviceFileStore } from "@noldova/teamrun-shell-desktop";
   *
   * export const store: DeviceFileStore = new DeviceFileStore("/home/person/.local/state/noldova/teamrun", "appearance.json");
   * ```
   */
  public constructor(folder: string, fileName: string);

  /**
   * Reads the object kept last.
   *
   * @returns A promise of the object, or `null` when the file does not exist.
   * @throws {SyntaxError} Asynchronously when the file is not JSON.
   * @throws {JsonException} Asynchronously when the file holds JSON that is not an object.
   * @example
   * ```ts
   * import { DeviceFileStore } from "@noldova/teamrun-shell-desktop";
   *
   * export function readAsync(folder: string): Promise<unknown> {
   *   return new DeviceFileStore(folder, "appearance.json").readAsync();
   * }
   * ```
   */
  public readAsync(): Promise<JsonObject | null>;

  /**
   * Keeps the object, after any write still in progress, creating the folder when needed.
   *
   * @param value The object to keep.
   * @returns A promise that settles once it is kept, and rejects when it could not be written.
   * @example
   * ```ts
   * import { DeviceFileStore } from "@noldova/teamrun-shell-desktop";
   *
   * export function keepAsync(folder: string): Promise<void> {
   *   return new DeviceFileStore(folder, "appearance.json").writeAsync({ "shell.mode": "Light" });
   * }
   * ```
   */
  public writeAsync(value: JsonObject): Promise<void>;

  /**
   * Removes the kept file, after any write still in progress; a missing file is not a failure.
   *
   * @returns A promise that settles once it is removed, and rejects when it could not be.
   * @example
   * ```ts
   * import { DeviceFileStore } from "@noldova/teamrun-shell-desktop";
   *
   * export function forgetAsync(folder: string): Promise<void> {
   *   return new DeviceFileStore(folder, "update-ready.json").deleteAsync();
   * }
   * ```
   */
  public deleteAsync(): Promise<void>;
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
   * @param now Reads the current time, in milliseconds.
   * @param wait Resolves after the given number of milliseconds, or rejects once the signal aborts.
   * @param updates Reads the launch barrier, saves the windows and quits, while it follows an update.
   * @example
   * ```ts
   * import { setTimeout as delay } from "node:timers/promises";
   *
   * import { type IRuntimeLauncher, type IUpdateHost, RuntimeStartup } from "@noldova/teamrun-shell-desktop";
   *
   * export function create(launcher: IRuntimeLauncher, updates: IUpdateHost): RuntimeStartup {
   *   return new RuntimeStartup(
   *     launcher, state => console.log(state.kind), () => false, 2000, event => console.log(event.name.text), message => console.error(message),
   *     Date.now, (milliseconds, signal) => delay(milliseconds, undefined, { signal }), updates);
   * }
   * ```
   */
  public constructor(
    launcher: IRuntimeLauncher,
    publish: (state: StartupState) => void,
    handOver: (handover: RuntimeHandover) => boolean,
    waitInterval: number,
    forward: (event: Event) => void,
    log: (message: string) => void,
    now: () => number,
    wait: (milliseconds: number, signal: AbortSignal) => Promise<void>,
    updates: IUpdateHost);

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
   * runtime disconnects until {@link close}. A connection that ends within 30 seconds of being ready ends soon: after
   * the first such end in a row it reconnects at once, then after 1, 2, 4 and 8 seconds, and the sixth is logged and
   * shown as a failure with its cause and an offer to try again, which counts afresh. A start or reconnection that
   * fails for any reason other than data from before the shell, an older build's work or a newer build is logged, an
   * unexpected failure in full, and shows the failure with an offer to try again.
   *
   * When the runtime announces `shell.updating`, the state becomes {@link StartupStateKind.Updating} with the version
   * the launch barrier names, the windows save, and the runtime is told what did not save with `shell.updateSaved`;
   * `shell.updateEnded` makes it ready again. A runtime that disconnects meanwhile is not reconnected: the launch
   * barrier is read every second instead, and the desktop quits once it is `Closing` and held by another desktop, or
   * reconnects once it is gone.
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
   * Closes the connection and stops reconnecting and waiting, ending a wait at once.
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
 * Decides which links TeamRun opens in the system's own application: well-formed http, https and mailto links without
 * credentials, at most 32768 characters long.
 */
export declare class LinkPolicy {
  /**
   * Finds the link to open for a URL the window asked to open.
   *
   * @param url The URL as the window sent it; any value.
   * @returns The link in its normalized form, or `null` for any other value, scheme or a URL that does not parse.
   * @example
   * ```ts
   * import { LinkPolicy } from "@noldova/teamrun-shell-desktop";
   *
   * export const link: string | null = LinkPolicy.findAllowed("https://example.com/docs");
   * ```
   */
  public static findAllowed(url: unknown): string | null;
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
  public constructor(host: INotificationHost, log: IDesktopLog, readIcon: () => string, isAnyWindowFocused: () => boolean, open: (id: string) => void);

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
 * Puts the command line on the macOS PATH by linking a folder on it, `/usr/local/bin`, to the command inside the app
 * bundle. When the folder cannot be written, it asks for an administrator through the system's prompt.
 */
export declare class PathCommand {
  /**
   * Creates the service for one command and one link.
   *
   * @param target The command inside the app bundle.
   * @param link The link to make on the PATH.
   * @param files The file operations it links with.
   * @param runProgramAsync Runs a program to its end, for the system's administrator prompt, and rejects with an error
   * whose message holds the program's standard error when it fails; `(-128)` in it means the person cancelled.
   * @example
   * ```ts
   * import { lstat, mkdir, readlink, rm, symlink } from "node:fs/promises";
   *
   * import { PathCommand } from "@noldova/teamrun-shell-desktop";
   *
   * export const command: PathCommand = new PathCommand("/Applications/TeamRun.app/Contents/Resources/bin/teamrun", "/usr/local/bin/teamrun",
   *   { lstat, readlink, rm, mkdir, symlink }, () => Promise.resolve());
   * ```
   */
  public constructor(target: string, link: string, files: IPathCommandFiles, runProgramAsync: (program: string, args: readonly string[]) => Promise<void>);

  /**
   * The link this service makes.
   *
   * @example
   * ```ts
   * import type { PathCommand } from "@noldova/teamrun-shell-desktop";
   *
   * export function describe(command: PathCommand): string {
   *   return `The command line is linked at ${command.linkPath}.`;
   * }
   * ```
   */
  public get linkPath(): string;

  /**
   * Creates the service for the bundle the desktop runs from, with Node.js's file operations: the command is
   * `Contents/Resources/bin/teamrun` and the link `/usr/local/bin/teamrun`.
   *
   * @param executablePath The program the desktop runs from, in `Contents/MacOS`.
   * @param runProgramAsync Runs a program to its end, for the system's administrator prompt, and rejects with an error
   * whose message holds the program's standard error when it fails; `(-128)` in it means the person cancelled.
   * @returns The service.
   * @example
   * ```ts
   * import { PathCommand } from "@noldova/teamrun-shell-desktop";
   *
   * export const command: PathCommand = PathCommand.forBundle("/Applications/TeamRun.app/Contents/MacOS/TeamRun", () => Promise.resolve());
   * ```
   */
  public static forBundle(executablePath: string, runProgramAsync: (program: string, args: readonly string[]) => Promise<void>): PathCommand;

  /**
   * Links the command on the PATH. A link to elsewhere is replaced; a file that is not a link is left alone. When the
   * link's folder cannot be written or read, the system's administrator prompt makes the folder and the link, and
   * leaves alone a file that is not a link, which it finds there with administrator rights.
   *
   * @returns A promise of what happened.
   * @throws PathCommandException, through the promise, when the link cannot be read or made, or the administrator
   * prompt fails for another reason than the person cancelling it.
   * @example
   * ```ts
   * import { type PathCommand, PathCommandOutcome } from "@noldova/teamrun-shell-desktop";
   *
   * export async function isLinkedAsync(command: PathCommand): Promise<boolean> {
   *   const outcome = await command.installAsync();
   *   return outcome === PathCommandOutcome.Installed || outcome === PathCommandOutcome.AlreadyInstalled;
   * }
   * ```
   */
  public installAsync(): Promise<PathCommandOutcome>;
}

/**
 * The exception thrown when the command cannot be linked on the macOS PATH.
 */
export declare class PathCommandException extends Exception {
  /**
   * The exception's name, `"PathCommandException"`, which the class sets itself so
   * that a minified build keeps it.
   */
  public override readonly name: string;

  /**
   * Creates the exception.
   *
   * @param message What went wrong.
   * @param options The underlying error, if any.
   * @example
   * ```ts
   * import { PathCommandException } from "@noldova/teamrun-shell-desktop";
   *
   * export const failure: PathCommandException = new PathCommandException("The teamrun command could not be linked at /usr/local/bin/teamrun.");
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * Runs other programs for the desktop, without a shell or a window.
 */
export interface IProgramHost {
  /**
   * Runs a program to its end.
   *
   * @param file The program, by its full path.
   * @param programArguments The program's arguments.
   * @param environment The program's environment.
   * @returns A promise of the program's standard output.
   * @throws ProgramException, through the promise, when the program cannot start, ends with an error or runs too long.
   * @example
   * ```ts
   * import type { IProgramHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function readVersionAsync(programs: IProgramHost): Promise<string> {
   *   return programs.runAsync("/usr/bin/gdbus", ["--version"], process.env);
   * }
   * ```
   */
  runAsync(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv): Promise<string>;

  /**
   * Starts a program that keeps running and passes its standard output on as it comes.
   *
   * @param file The program, by its full path.
   * @param programArguments The program's arguments.
   * @param environment The program's environment.
   * @param onOutput Receives each piece of the program's standard output.
   * @param onExit Called once, when the program ends or cannot start.
   * @returns The running program.
   * @example
   * ```ts
   * import type { IProgramHost, StartedProgram } from "@noldova/teamrun-shell-desktop";
   *
   * export function monitor(programs: IProgramHost): StartedProgram {
   *   return programs.start("/usr/bin/gdbus", ["monitor", "--session"], process.env, t => console.log(t), () => console.log("ended"));
   * }
   * ```
   */
  start(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv, onOutput: (text: string) => void, onExit: () => void): StartedProgram;
}

/**
 * A program that an {@link IProgramHost} started.
 */
export declare class StartedProgram {
  /**
   * Creates the running program.
   *
   * @param end Ends the program.
   * @example
   * ```ts
   * import { StartedProgram } from "@noldova/teamrun-shell-desktop";
   *
   * export const program: StartedProgram = new StartedProgram(() => undefined);
   * ```
   */
  public constructor(end: () => void);

  /**
   * Ends the program; its host's exit callback follows once it has ended.
   *
   * @example
   * ```ts
   * import type { StartedProgram } from "@noldova/teamrun-shell-desktop";
   *
   * export function end(program: StartedProgram): void {
   *   program.stop();
   * }
   * ```
   */
  public stop(): void;
}

/**
 * Runs other programs as child processes of the desktop. On Linux each program starts through the
 * runtime's `ProcessLaunchCommand`, so it keeps none of the desktop's descriptors above standard error,
 * such as Chromium's channels to its own processes.
 */
export declare class ChildProgramHost implements IProgramHost {
  /**
   * Creates the host.
   *
   * @param platform The platform, as in `process.platform`.
   * @param timeout How long, in milliseconds, a program run to its end may take before it is ended and fails.
   * @example
   * ```ts
   * import { ChildProgramHost } from "@noldova/teamrun-shell-desktop";
   *
   * export const programs: ChildProgramHost = new ChildProgramHost(process.platform, 5000);
   * ```
   */
  public constructor(platform: string, timeout: number);

  /**
   * Runs a program to its end.
   *
   * @param file The program, by its full path.
   * @param programArguments The program's arguments.
   * @param environment The program's environment.
   * @returns A promise of the program's standard output.
   * @throws ProgramException, through the promise, when the program cannot start, ends with an error, runs longer than
   * the timeout or writes more than 64 KiB, or on Linux when `/bin/bash` or `/proc/self/fd` is unavailable.
   * @throws ArgumentException, through the promise, when the program's path is empty or whitespace.
   * @example
   * ```ts
   * import type { ChildProgramHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function readVersionAsync(programs: ChildProgramHost): Promise<string> {
   *   return programs.runAsync("/usr/bin/gdbus", ["--version"], process.env);
   * }
   * ```
   */
  public runAsync(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv): Promise<string>;

  /**
   * Starts a program that keeps running and passes its standard output on as it comes.
   *
   * @param file The program, by its full path.
   * @param programArguments The program's arguments.
   * @param environment The program's environment.
   * @param onOutput Receives each piece of the program's standard output.
   * @param onExit Called once, when the program ends or cannot start, including on Linux when `/bin/bash` or
   * `/proc/self/fd` is unavailable.
   * @throws {ArgumentException} When the program's path is empty or whitespace.
   * @returns The running program.
   * @example
   * ```ts
   * import type { ChildProgramHost, StartedProgram } from "@noldova/teamrun-shell-desktop";
   *
   * export function monitor(programs: ChildProgramHost): StartedProgram {
   *   return programs.start("/usr/bin/gdbus", ["monitor", "--session"], process.env, t => console.log(t), () => console.log("ended"));
   * }
   * ```
   */
  public start(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv, onOutput: (text: string) => void, onExit: () => void): StartedProgram;

  /**
   * Starts a program in its own session that outlives the desktop, with its standard streams ignored.
   *
   * @param file The program, by its full path.
   * @param programArguments The program's arguments.
   * @param environment The program's environment.
   * @param onFailure Called with the reason when the program cannot be started: a `LaunchException` on Linux when
   * `/bin/bash` is not executable or `/proc/self/fd` cannot be read, or the error the system gives elsewhere. On Linux
   * the program starts through Bash, which reports nothing back when the program itself is missing.
   * @throws {ArgumentException} When the program's path is empty or whitespace.
   * @example
   * ```ts
   * import type { ChildProgramHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function handOver(programs: ChildProgramHost, executablePath: string, log: (text: string) => void): void {
   *   programs.startDetached(executablePath, ["--data-dir=/home/person/work-data"], process.env, t => log(String(t)));
   * }
   * ```
   */
  public startDetached(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv, onFailure: (error: Error) => void): void;

  /**
   * Starts a program in its own session that outlives the desktop, with its standard streams ignored, in the given
   * folder.
   *
   * @param file The program, by its full path.
   * @param programArguments The program's arguments.
   * @param environment The program's environment.
   * @param workingDirectory The folder the program starts in.
   * @returns A promise that settles once the program has started. On Linux the program starts through Bash, so the
   * promise settles once Bash has started and does not report the program itself missing.
   * @throws {LaunchException} Asynchronously on Linux when `/bin/bash` is not executable or `/proc/self/fd` cannot be
   * read.
   * @throws Error asynchronously with the reason the system gives when the program cannot be started elsewhere.
   * @throws {ArgumentException} Asynchronously when the program's path is empty or whitespace.
   * @example
   * ```ts
   * import type { ChildProgramHost } from "@noldova/teamrun-shell-desktop";
   *
   * export function relaunchAsync(programs: ChildProgramHost, executablePath: string): Promise<void> {
   *   return programs.startDetachedAsync(executablePath, [], process.env, process.cwd());
   * }
   * ```
   */
  public startDetachedAsync(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv, workingDirectory: string): Promise<void>;
}

/**
 * The exception a program host gives when a program cannot start, ends with an error or runs too long.
 */
export declare class ProgramException extends Exception {
  /**
   * The exception's name, `"ProgramException"`, which the class sets itself so
   * that a minified build keeps it.
   */
  public override readonly name: string;

  /**
   * Creates the exception.
   *
   * @param message What went wrong, naming the program.
   * @param options The underlying error, if any.
   * @example
   * ```ts
   * import { ProgramException } from "@noldova/teamrun-shell-desktop";
   *
   * export const failure: ProgramException = new ProgramException("/usr/bin/gdbus failed: spawn /usr/bin/gdbus ENOENT");
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * Tells whether the desktop has somewhere to show a tray icon. Windows and macOS always have one. On Linux it asks the
 * session bus, through `/usr/bin/gdbus`, whether a StatusNotifierWatcher has a host registered, and asks again whenever
 * the watcher's name changes owner or the watcher signals a host coming or going. A missing `gdbus`, a missing watcher
 * or a failed answer means no host. When the monitor ends, it asks once and starts the monitor again after a wait that
 * begins at a second and doubles up to a minute, back to a second once the monitor is heard again.
 */
export declare class TrayHostWatcher {
  /**
   * Creates the watcher.
   *
   * @param platform The platform, as `process.platform` names it.
   * @param programs Runs `gdbus`.
   * @param environment The environment `gdbus` runs in, which names the session bus.
   * @param delayAsync Waits the given milliseconds before the monitor starts again.
   * @param onChange Called with the new answer whenever it changes.
   * @example
   * ```ts
   * import { ChildProgramHost, TrayHostWatcher } from "@noldova/teamrun-shell-desktop";
   *
   * export const watcher: TrayHostWatcher = new TrayHostWatcher(process.platform, new ChildProgramHost(process.platform, 5000), process.env,
   *   t => new Promise<void>(resolve => setTimeout(resolve, t)), t => console.log(t));
   * ```
   */
  public constructor(platform: string, programs: IProgramHost, environment: NodeJS.ProcessEnv, delayAsync: (milliseconds: number) => Promise<void>, onChange: (isAvailable: boolean) => void);

  /**
   * Whether a tray host is there: always on Windows and macOS; on Linux, not until the session bus says so.
   */
  public get isAvailable(): boolean;

  /**
   * Starts watching the session bus on Linux; elsewhere, and when it already watches, it does nothing.
   *
   * @example
   * ```ts
   * import type { TrayHostWatcher } from "@noldova/teamrun-shell-desktop";
   *
   * export function watch(watcher: TrayHostWatcher): void {
   *   watcher.start();
   * }
   * ```
   */
  public start(): void;

  /**
   * Stops watching, ends the monitor and ignores answers that arrive afterward; the last answer stays.
   *
   * @example
   * ```ts
   * import type { TrayHostWatcher } from "@noldova/teamrun-shell-desktop";
   *
   * export function close(watcher: TrayHostWatcher): void {
   *   watcher.stop();
   * }
   * ```
   */
  public stop(): void;
}

/**
 * The update's states, which the window shows.
 */
export declare enum UpdateStateKind {
  /**
   * The build names no update feed, so it never checks.
   */
  Off = "Off",
  /**
   * No newer version was found, or no check has run yet.
   */
  UpToDate = "UpToDate",
  /**
   * A check is running.
   */
  Checking = "Checking",
  /**
   * A newer version was found on macOS outside an Applications folder, where nothing downloads.
   */
  Available = "Available",
  /**
   * A newer version is downloading.
   */
  Downloading = "Downloading",
  /**
   * A downloaded, checked version waits for Restart to update.
   */
  Ready = "Ready",
  /**
   * A check the person asked for, or a download, failed.
   */
  Failed = "Failed"
}

/**
 * The exception thrown when the desktop cannot use the data folder it was given, whose message names the folder and
 * the reason and is what the start-failure box shows.
 */
export declare class UnusableFolderException extends Exception {
  /**
   * The exception's name, `"UnusableFolderException"`, which the class sets itself so
   * that a minified build keeps it.
   */
  public override readonly name: string;

  /**
   * Creates the exception.
   *
   * @param message The folder and why it cannot be used.
   * @param options The underlying error, if any.
   * @example
   * ```ts
   * import { UnusableFolderException } from "@noldova/teamrun-shell-desktop";
   *
   * export const failure: UnusableFolderException = new UnusableFolderException("TeamRun cannot use the data folder /home/person/data: Error: Failed to set path");
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * A failed update, whose message is the reason the window shows.
 */
export declare class UpdateException extends Exception {
  /**
   * The exception's name, `"UpdateException"`, which the class sets itself so that a minified build keeps it.
   */
  public override readonly name: string;

  /**
   * Creates the exception.
   *
   * @param message The reason, such as "The download doesn't match the release.".
   * @param options The failure that caused it.
   * @example
   * ```ts
   * import { UpdateException } from "@noldova/teamrun-shell-desktop";
   *
   * export const failure: UpdateException = new UpdateException("The download was interrupted.");
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * The response of the update feed, as `fetch` gives it.
 */
export interface IFeedResponse {
  /**
   * Whether the status is in the 200 range.
   */
  readonly ok: boolean;

  /**
   * The HTTP status.
   */
  readonly status: number;

  /**
   * The URL that answered, after any redirects.
   */
  readonly url: string;

  /**
   * Reads the body as text.
   *
   * @returns A promise of the body.
   * @example
   * ```ts
   * import type { IFeedResponse } from "@noldova/teamrun-shell-desktop";
   *
   * export function readAsync(response: IFeedResponse): Promise<string> {
   *   return response.text();
   * }
   * ```
   */
  text(): Promise<string>;
}

/**
 * What a desktop updates with: its platform's updater and the handoff that installs what the updater made ready.
 */
export interface IUpdateSetup {
  /**
   * The updater, which checks, downloads and validates.
   */
  readonly updater: IUpdater;

  /**
   * The handoff of the desktop's platform.
   */
  readonly handoff: IUpdateHandoff;
}

/**
 * Checks for a newer version and downloads it.
 */
export interface IUpdater {
  /**
   * The only file a download may give: the target's package in the updater's cache for the installation.
   */
  readonly packagePath: string;

  /**
   * The file the last download in this process gave, or `null` before one has and while a download runs.
   */
  readonly downloadedFile: string | null;

  /**
   * Checks the feed.
   *
   * @returns A promise of the newer version, or `null` when this one is up to date; it rejects with an
   * {@link UpdateException} that gives the reason.
   * @example
   * ```ts
   * import type { IUpdater } from "@noldova/teamrun-shell-desktop";
   *
   * export async function isUpToDateAsync(updater: IUpdater): Promise<boolean> {
   *   return await updater.checkAsync() === null;
   * }
   * ```
   */
  checkAsync(): Promise<string | null>;

  /**
   * Downloads the version the last check found and checks it against the release.
   *
   * @param onProgress Receives the progress as a whole percentage.
   * @returns A promise of the downloaded file; it rejects with an {@link UpdateException} that gives the reason.
   * @example
   * ```ts
   * import type { IUpdater } from "@noldova/teamrun-shell-desktop";
   *
   * export function downloadAsync(updater: IUpdater): Promise<string> {
   *   return updater.downloadAsync(t => console.log(`${t}%`));
   * }
   * ```
   */
  downloadAsync(onProgress: (percent: number) => void): Promise<string>;

  /**
   * Cancels the download in progress, if any.
   *
   * @example
   * ```ts
   * import type { IUpdater } from "@noldova/teamrun-shell-desktop";
   *
   * export function quit(updater: IUpdater): void {
   *   updater.cancel();
   * }
   * ```
   */
  cancel(): void;
}

/**
 * Lets one desktop of an installation check for updates at a time.
 */
export interface IUpdateCheckLock {
  /**
   * Takes the lock unless a running desktop holds it.
   *
   * @returns A promise of whether this desktop now holds the lock.
   * @example
   * ```ts
   * import type { IUpdateCheckLock } from "@noldova/teamrun-shell-desktop";
   *
   * export function tryAsync(lock: IUpdateCheckLock): Promise<boolean> {
   *   return lock.tryAcquireAsync();
   * }
   * ```
   */
  tryAcquireAsync(): Promise<boolean>;

  /**
   * Lets go of the lock this desktop holds, if any.
   *
   * @returns A promise that settles once the lock is let go.
   * @example
   * ```ts
   * import type { IUpdateCheckLock } from "@noldova/teamrun-shell-desktop";
   *
   * export function releaseAsync(lock: IUpdateCheckLock): Promise<void> {
   *   return lock.releaseAsync();
   * }
   * ```
   */
  releaseAsync(): Promise<void>;
}

/**
 * The part of electron-updater's `AppUpdater` that {@link FeedUpdater} drives.
 */
export interface IAppUpdater {
  /**
   * Whether a check downloads at once.
   */
  autoDownload: boolean;
  /**
   * Whether quitting installs a downloaded update.
   */
  autoInstallOnAppQuit: boolean;
  /**
   * Whether an older version is offered.
   */
  allowDowngrade: boolean;
  /**
   * Whether a prerelease is offered.
   */
  allowPrerelease: boolean;
  /**
   * Whether only changed blocks download.
   */
  disableDifferentialDownload: boolean;
  /**
   * Whether a web installer is refused.
   */
  disableWebInstaller: boolean;
  /**
   * Receives the updater's messages.
   */
  logger: Logger | null;
  /**
   * The file of the updater's own settings.
   */
  updateConfigPath: string | null;
  /**
   * Decides whether a found version is offered.
   */
  isUpdateSupported: (info: UpdateInfo) => boolean | Promise<boolean>;

  /**
   * Sets the feed's provider.
   *
   * @param options The custom provider and its source.
   * @example
   * ```ts
   * import { FeedProvider, type FeedSource, type IAppUpdater } from "@noldova/teamrun-shell-desktop";
   *
   * export function point(updater: IAppUpdater, source: FeedSource): void {
   *   updater.setFeedURL({ provider: "custom", updateProvider: FeedProvider, source });
   * }
   * ```
   */
  setFeedURL(options: { readonly provider: "custom"; readonly updateProvider: typeof FeedProvider; readonly source: FeedSource }): void;

  /**
   * Checks the feed.
   *
   * @returns A promise of the result, or `null` when the updater is not active.
   * @example
   * ```ts
   * import type { IAppUpdater } from "@noldova/teamrun-shell-desktop";
   *
   * export async function hasUpdateAsync(updater: IAppUpdater): Promise<boolean> {
   *   return (await updater.checkForUpdates())?.isUpdateAvailable === true;
   * }
   * ```
   */
  checkForUpdates(): Promise<{ readonly isUpdateAvailable: boolean; readonly updateInfo: UpdateInfo } | null>;

  /**
   * Downloads the update the last check found.
   *
   * @param cancellationToken Cancels the download.
   * @returns A promise of the downloaded files.
   * @example
   * ```ts
   * import { CancellationToken } from "electron-updater";
   * import type { IAppUpdater } from "@noldova/teamrun-shell-desktop";
   *
   * export function downloadAsync(updater: IAppUpdater): Promise<string[]> {
   *   return updater.downloadUpdate(new CancellationToken());
   * }
   * ```
   */
  downloadUpdate(cancellationToken: CancellationToken): Promise<string[]>;

  /**
   * Listens to the download's progress.
   *
   * @param event `download-progress`.
   * @param listener Receives the progress.
   * @returns The updater.
   * @example
   * ```ts
   * import type { IAppUpdater } from "@noldova/teamrun-shell-desktop";
   *
   * export function watch(updater: IAppUpdater): void {
   *   updater.on("download-progress", t => console.log(t.percent));
   * }
   * ```
   */
  on(event: "download-progress", listener: (info: ProgressInfo) => void): unknown;

  /**
   * Stops listening to the download's progress.
   *
   * @param event `download-progress`.
   * @param listener The listener given to {@link IAppUpdater.on}.
   * @returns The updater.
   * @example
   * ```ts
   * import type { IAppUpdater } from "@noldova/teamrun-shell-desktop";
   *
   * export function unwatch(updater: IAppUpdater, listener: () => void): void {
   *   updater.removeListener("download-progress", listener);
   * }
   * ```
   */
  removeListener(event: "download-progress", listener: (info: ProgressInfo) => void): unknown;
}

/**
 * Where the update feed is and which of its files belong to this platform and processor.
 */
export declare class FeedSource {
  /**
   * The feed's URL, ending in `/`.
   */
  public readonly feed: string;
  /**
   * The update information's file, `latest-<platform>-<arch>.yml`.
   */
  public readonly channelFile: string;
  /**
   * The package the updater downloads, `<product>-<platform>-<arch>.<ext>`.
   */
  public readonly packageFile: string;
  /**
   * Fetches a URL anonymously, following redirects, until the signal aborts.
   */
  public readonly fetchAsync: (url: string, signal: AbortSignal) => Promise<IFeedResponse>;

  /**
   * Creates the source.
   *
   * @param feed The feed's URL, ending in `/`.
   * @param channelFile The update information's file.
   * @param packageFile The package the updater downloads.
   * @param fetchAsync Fetches a URL anonymously, following redirects, until the signal aborts; the signal aborts when the
   * feed hasn't answered with the whole information file within 30 seconds.
   * @example
   * ```ts
   * import { FeedSource } from "@noldova/teamrun-shell-desktop";
   *
   * export const source: FeedSource = new FeedSource("http://127.0.0.1:8080/", "latest-linux-x64.yml", "TeamRun-linux-x64.AppImage", (url, signal) => fetch(url, { signal }));
   * ```
   */
  public constructor(feed: string, channelFile: string, packageFile: string, fetchAsync: (url: string, signal: AbortSignal) => Promise<IFeedResponse>);

  /**
   * Creates the source of a platform and processor: Windows' installer, macOS's ZIP or Linux's AppImage, on x64 or
   * ARM64; the feed has 30 seconds to answer.
   *
   * @param feed The product's feed, or `null` for a build that never checks.
   * @param productName The product's name, which starts the package's name.
   * @param platform Node's platform, such as `win32`.
   * @param architecture Node's processor, such as `arm64`.
   * @param fetchAsync Fetches a URL anonymously, following redirects, until the signal aborts.
   * @returns The source, or `null` when there is no feed or the target has no packages.
   * @example
   * ```ts
   * import { FeedSource } from "@noldova/teamrun-shell-desktop";
   *
   * export const source: FeedSource | null = FeedSource.create("http://127.0.0.1:8080/", "TeamRun", process.platform, process.arch, (url, signal) => fetch(url, { signal }));
   * ```
   */
  public static create(feed: string | null, productName: string, platform: string, architecture: string, fetchAsync: (url: string, signal: AbortSignal) => Promise<IFeedResponse>): FeedSource | null;
}

/**
 * electron-updater's provider for TeamRun's feed: it reads the update information of the source's target and gives
 * the package it names, resolved against the URL that answered, so the package comes from the same release.
 */
export declare class FeedProvider extends Provider<UpdateInfo> {
  /**
   * Creates the provider, as electron-updater does for a custom provider.
   *
   * @param options The feed's options, whose `source` is a {@link FeedSource}.
   * @param _updater The updater, which the provider does not use.
   * @param runtimeOptions electron-updater's runtime options.
   * @throws {ArgumentException} When the options hold no source.
   * @example
   * ```ts
   * import type { ProviderRuntimeOptions } from "electron-updater/out/providers/Provider.js";
   * import { FeedProvider, type FeedSource } from "@noldova/teamrun-shell-desktop";
   *
   * export function create(source: FeedSource, runtimeOptions: ProviderRuntimeOptions): FeedProvider {
   *   return new FeedProvider({ source }, null, runtimeOptions);
   * }
   * ```
   */
  public constructor(options: Readonly<Record<string, unknown>>, _updater: unknown, runtimeOptions: ProviderRuntimeOptions);

  /**
   * Reads the update information: its version and a package named as the source's, with a SHA-512 and a size.
   *
   * @returns A promise of the information; it rejects with an {@link UpdateException} when the feed cannot be
   * reached or refuses, or the information is invalid.
   * @example
   * ```ts
   * import type { FeedProvider } from "@noldova/teamrun-shell-desktop";
   *
   * export async function latestAsync(provider: FeedProvider): Promise<string> {
   *   return (await provider.getLatestVersion()).version;
   * }
   * ```
   */
  public getLatestVersion(): Promise<UpdateInfo>;

  /**
   * Gives the package to download, beside the update information that was read.
   *
   * @param updateInfo The update information {@link FeedProvider.getLatestVersion} gave.
   * @returns The package.
   * @throws {UpdateException} When no information was read or it names no such package.
   * @example
   * ```ts
   * import type { UpdateInfo } from "electron-updater";
   * import type { FeedProvider } from "@noldova/teamrun-shell-desktop";
   *
   * export function packageUrl(provider: FeedProvider, info: UpdateInfo): string | undefined {
   *   return provider.resolveFiles(info)[0]?.url.href;
   * }
   * ```
   */
  public resolveFiles(updateInfo: UpdateInfo): ResolvedUpdateFileInfo[];
}

/**
 * Drives electron-updater against TeamRun's feed: it checks without downloading, offers only a higher version without
 * a prerelease suffix, installs nothing by itself and gives each failure its reason.
 */
export declare class FeedUpdater implements IUpdater {
  /**
   * The target's package in electron-updater's cache folder for the installation, the only file a download may give.
   */
  public readonly packagePath: string;

  /**
   * The file the last download in this process gave, or `null` before one has and while a download runs.
   */
  public get downloadedFile(): string | null;

  /**
   * Creates the updater and sets electron-updater up.
   *
   * @param updater electron-updater's updater for the platform.
   * @param source The feed.
   * @param installationFolder The installation's folder, which holds electron-updater's settings file
   * `update-config.json` and whose name, the installation's id, names its cache folder.
   * @param cacheRoot The user's cache folder, where electron-updater keeps `<slug>-updater-<installation id>`.
   * @param productSlug The product's slug.
   * @param verifyAsync Checks a downloaded file's publisher, resolving to `null` when it is the product's publisher and
   * otherwise to why not, or `null` on a platform whose updates carry no publisher to check.
   * @param log Records the updater's warnings and errors, and a download that failed its publisher check but could not be
   * deleted.
   * @example
   * ```ts
   * import { AppImageUpdater } from "electron-updater";
   * import { FeedSource, FeedUpdater } from "@noldova/teamrun-shell-desktop";
   *
   * export const updater: FeedUpdater = new FeedUpdater(new AppImageUpdater(),
   *   new FeedSource("http://127.0.0.1:8080/", "latest-linux-x64.yml", "TeamRun-linux-x64.AppImage", (url, signal) => fetch(url, { signal })),
   *   "/home/person/.local/state/noldova/teamrun/installations/0123456789abcdef", "/home/person/.cache", "teamrun", null, console.error);
   * ```
   */
  public constructor(
    updater: IAppUpdater,
    source: FeedSource,
    installationFolder: string,
    cacheRoot: string,
    productSlug: string,
    verifyAsync: ((file: string) => Promise<string | null>) | null,
    log: (text: string) => void);

  /**
   * Checks the feed; before the first check it writes electron-updater's settings and then points it at the feed, since
   * naming the settings file drops the feed set before.
   *
   * @returns A promise of the newer version, or `null` when this one is up to date; it rejects with an
   * {@link UpdateException} that gives the reason, by default that the update stopped on an unexpected error.
   * @example
   * ```ts
   * import type { FeedUpdater } from "@noldova/teamrun-shell-desktop";
   *
   * export function checkAsync(updater: FeedUpdater): Promise<string | null> {
   *   return updater.checkAsync();
   * }
   * ```
   */
  public checkAsync(): Promise<string | null>;

  /**
   * Downloads the version the last check found; electron-updater checks its SHA-512, and then the updater checks its
   * publisher, deleting a file that fails.
   *
   * @param onProgress Receives the progress as a whole percentage.
   * @returns A promise of the downloaded file; it rejects with an {@link UpdateException} that gives the reason, by
   * default that the download was interrupted, and with an unexpected error when the file is not
   * {@link FeedUpdater.packagePath}.
   * @example
   * ```ts
   * import type { FeedUpdater } from "@noldova/teamrun-shell-desktop";
   *
   * export function downloadAsync(updater: FeedUpdater): Promise<string> {
   *   return updater.downloadAsync(t => console.log(`${t}%`));
   * }
   * ```
   */
  public downloadAsync(onProgress: (percent: number) => void): Promise<string>;

  /**
   * Cancels the download in progress, if any.
   *
   * @example
   * ```ts
   * import type { FeedUpdater } from "@noldova/teamrun-shell-desktop";
   *
   * export function quit(updater: FeedUpdater): void {
   *   updater.cancel();
   * }
   * ```
   */
  public cancel(): void;
}

/**
 * Lets one desktop of an installation check for updates at a time with `update-check.lock` in the installation's
 * folder, which names the holder's process. It is created whole through a temporary file and a link, and a lock whose
 * process is gone, or that cannot be read as a process, is taken over; a lock that cannot be read at all counts as
 * held.
 */
export declare class UpdateCheckLock implements IUpdateCheckLock {
  /**
   * Creates the lock.
   *
   * @param folder The installation's folder.
   * @param stampAsync Gives this desktop's process, or `null` when it cannot be found.
   * @param isRunningAsync Whether a holder's process still runs.
   * @param log Records a lock that could not be removed.
   * @example
   * ```ts
   * import type { Installation, ProcessPresence } from "@noldova/teamrun-shell-runtime";
   * import { UpdateCheckLock } from "@noldova/teamrun-shell-desktop";
   *
   * export function create(installation: Installation, presence: ProcessPresence): UpdateCheckLock {
   *   return new UpdateCheckLock(installation.folder, async () => (await presence.stampAsync([[process.pid, "desktop"]]))[0] ?? null, t => presence.isRunningAsync(t), console.error);
   * }
   * ```
   */
  public constructor(folder: string, stampAsync: () => Promise<UpdateProcess | null>, isRunningAsync: (holder: UpdateProcess) => Promise<boolean>, log: (text: string) => void);

  /**
   * Takes the lock unless another running desktop holds it; a lock that still names this desktop's process, left
   * behind by a release that failed, is taken back.
   *
   * @returns A promise of whether this desktop now holds the lock.
   * @throws {UpdateException} Rejected when this desktop's process cannot be found.
   * @throws {Error} Rejected when the lock can neither be created nor found, or a stale one cannot be claimed.
   * @example
   * ```ts
   * import type { UpdateCheckLock } from "@noldova/teamrun-shell-desktop";
   *
   * export function tryAsync(lock: UpdateCheckLock): Promise<boolean> {
   *   return lock.tryAcquireAsync();
   * }
   * ```
   */
  public tryAcquireAsync(): Promise<boolean>;

  /**
   * Lets go of the lock this desktop holds; a lock another desktop has taken over since is left in place, and a lock
   * that cannot be removed is logged and left behind.
   *
   * @returns A promise that settles once the lock is let go; it never rejects.
   * @example
   * ```ts
   * import type { UpdateCheckLock } from "@noldova/teamrun-shell-desktop";
   *
   * export function releaseAsync(lock: UpdateCheckLock): Promise<void> {
   *   return lock.releaseAsync();
   * }
   * ```
   */
  public releaseAsync(): Promise<void>;
}

/**
 * Checks that a Windows update carries a valid signature by the publisher. It reads the signature with Windows
 * PowerShell's `Get-AuthenticodeSignature`, started by its full path without a shell and without the caller's
 * `PSModulePath`, and passes it only when it is valid, belongs to the file and its signer's distinguished name holds
 * every field of the publisher's; any other answer, an unreadable one or a failed or timed-out PowerShell counts as
 * failed, with one line saying why.
 */
export declare class PublisherCheck {
  /**
   * Creates the check.
   *
   * @param publisher The publisher's distinguished name.
   * @param command Runs PowerShell.
   * @param environment Supplies `SystemRoot` and the rest of PowerShell's environment.
   * @param log Records each check, its duration and whether it passed, in one line; the reason of a failure is left to
   * the caller, so it is logged once.
   * @param now Gives the time in milliseconds.
   * @example
   * ```ts
   * import { SystemCommand } from "@noldova/teamrun-shell-runtime";
   * import { PublisherCheck } from "@noldova/teamrun-shell-desktop";
   *
   * export const check: PublisherCheck = new PublisherCheck("CN=Noldova, O=Noldova, C=MD", new SystemCommand(), process.env, console.log, Date.now);
   * ```
   */
  public constructor(publisher: string, command: Pick<SystemCommand, "runAsync">, environment: NodeJS.ProcessEnv, log: (text: string) => void, now: () => number);

  /**
   * Checks a file.
   *
   * @param file The downloaded installer.
   * @returns A promise of `null` when the signature is the publisher's, otherwise of why it is not.
   * @example
   * ```ts
   * import type { PublisherCheck } from "@noldova/teamrun-shell-desktop";
   *
   * export async function isSignedAsync(check: PublisherCheck, file: string): Promise<boolean> {
   *   return await check.checkAsync(file) === null;
   * }
   * ```
   */
  public checkAsync(file: string): Promise<string | null>;
}

/**
 * The update's state as the window reads it.
 */
export declare class UpdateStatus {
  /**
   * The state of a build that names no feed.
   */
  public static readonly off: UpdateStatus;

  /**
   * The state's kind.
   */
  public readonly kind: UpdateStateKind;
  /**
   * The version found, downloading or ready, otherwise `null`.
   */
  public readonly version: string | null;
  /**
   * The download's whole percentage, or `null`.
   */
  public readonly progress: number | null;
  /**
   * When the last check succeeded, in milliseconds since the epoch, or `null`.
   */
  public readonly checkedAt: number | null;
  /**
   * Why the last check or download failed, or `null`.
   */
  public readonly reason: string | null;
  /**
   * Whether TeamRun must move to Applications to update.
   */
  public readonly mustMove: boolean;

  /**
   * Creates the state.
   *
   * @param kind The state's kind.
   * @param version The version, or `null`.
   * @param progress The download's percentage, or `null`.
   * @param checkedAt When the last check succeeded, or `null`.
   * @param reason Why the last check or download failed, or `null`.
   * @param mustMove Whether TeamRun must move to Applications.
   * @example
   * ```ts
   * import { UpdateStateKind, UpdateStatus } from "@noldova/teamrun-shell-desktop";
   *
   * export const ready: UpdateStatus = new UpdateStatus(UpdateStateKind.Ready, "1.3.0", null, null, null, false);
   * ```
   */
  public constructor(kind: UpdateStateKind, version: string | null, progress: number | null, checkedAt: number | null, reason: string | null, mustMove: boolean);

  /**
   * Whether a check, a download or a ready update rules out a new check.
   */
  public get isBusy(): boolean;

  /**
   * Gives the state as the window reads it.
   *
   * @returns The state's fields.
   * @example
   * ```ts
   * import { UpdateStatus } from "@noldova/teamrun-shell-desktop";
   *
   * export const off: unknown = UpdateStatus.off.toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The record of a ready update in its installation's folder, `update-ready.json`.
 */
export declare class UpdateReadyRecord {
  /**
   * The ready version.
   */
  public readonly version: string;
  /**
   * The downloaded file.
   */
  public readonly file: string;
  /**
   * The file's SHA-512 in base64.
   */
  public readonly sha512: string;
  /**
   * Whether the desktop has posted `shell.updateReady` for it.
   */
  public readonly isNotified: boolean;

  /**
   * Creates the record.
   *
   * @param version The ready version.
   * @param file The downloaded file.
   * @param sha512 The file's SHA-512 in base64.
   * @param isNotified Whether `shell.updateReady` was posted.
   * @example
   * ```ts
   * import { UpdateReadyRecord } from "@noldova/teamrun-shell-desktop";
   *
   * export const record: UpdateReadyRecord = new UpdateReadyRecord("1.3.0", "/tmp/TeamRun-linux-x64.AppImage", "c2hh", false);
   * ```
   */
  public constructor(version: string, file: string, sha512: string, isNotified: boolean);

  /**
   * Reads a record.
   *
   * @param value The record's JSON.
   * @returns The record.
   * @throws {JsonException} When a field is missing or of the wrong type.
   * @example
   * ```ts
   * import { UpdateReadyRecord } from "@noldova/teamrun-shell-desktop";
   *
   * export const record: UpdateReadyRecord = UpdateReadyRecord.fromJson({ version: "1.3.0", file: "/tmp/a", sha512: "c2hh", notified: true });
   * ```
   */
  public static fromJson(value: unknown): UpdateReadyRecord;

  /**
   * Gives the same record, marked as posted.
   *
   * @returns The record.
   * @example
   * ```ts
   * import type { UpdateReadyRecord } from "@noldova/teamrun-shell-desktop";
   *
   * export function post(record: UpdateReadyRecord): UpdateReadyRecord {
   *   return record.notified();
   * }
   * ```
   */
  public notified(): UpdateReadyRecord;

  /**
   * Gives the record's JSON.
   *
   * @returns The record's fields.
   * @example
   * ```ts
   * import type { UpdateReadyRecord } from "@noldova/teamrun-shell-desktop";
   *
   * export function write(record: UpdateReadyRecord): unknown {
   *   return record.toJson();
   * }
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Runs the update up to Ready: the checks `shell.updateChecks` asks for, the download, the ready record, which a
 * restart checks again, and the one `shell.updateReady` notification of each ready version.
 */
export declare class UpdateController {
  /**
   * Creates the controller.
   *
   * @param updater Checks and downloads.
   * @param record The ready record's file.
   * @param lock Lets one desktop of the installation check and download at a time.
   * @param currentVersion The installed version.
   * @param mustMove Whether TeamRun runs on macOS outside an Applications folder, where a newer version only shows
   * as available.
   * @param refusal Why this copy can never install an update, such as {@link IUpdateHandoff.refusal}, or `null`. A newer
   * version, and a ready update from its record, then show as failed with this reason, so nothing is downloaded,
   * posted or restarted.
   * @param publish Receives each state.
   * @param postReadyAsync Posts `shell.updateReady` for a version, resolving to whether the runtime took it.
   * @param log Records each failure in one line with its reason, without the exception's name.
   * @param now Gives the time in milliseconds.
   * @param schedule Runs a callback after a delay and gives what cancels it.
   * @param restartAsync Restarts to install a ready update: asks about work in progress, stops the installation and
   * hands the update over, resolving when the person cancels; or `null` while Restart to update is refused.
   * @example
   * ```ts
   * import { DeviceFileStore, type IUpdateCheckLock, type IUpdater, UpdateController } from "@noldova/teamrun-shell-desktop";
   *
   * export function create(updater: IUpdater, lock: IUpdateCheckLock): UpdateController {
   *   return new UpdateController(updater, new DeviceFileStore("/tmp/installation", "update-ready.json"), lock, "1.2.0", false, null, console.log,
   *     () => Promise.resolve(true), console.error, Date.now, (wait, run) => {
   *       const timer = setTimeout(run, wait);
   *       return () => clearTimeout(timer);
   *     }, null);
   * }
   * ```
   */
  public constructor(
    updater: IUpdater,
    record: IDeviceFileStore,
    lock: IUpdateCheckLock,
    currentVersion: string,
    mustMove: boolean,
    refusal: string | null,
    publish: (status: UpdateStatus) => void,
    postReadyAsync: (version: string) => Promise<boolean>,
    log: (text: string) => void,
    now: () => number,
    schedule: (delay: number, run: () => void) => () => void,
    restartAsync: ((record: UpdateReadyRecord) => Promise<void>) | null);

  /**
   * Gives a file's SHA-512.
   *
   * @param file The file.
   * @returns A promise of the SHA-512 in base64; it rejects when the file cannot be read.
   * @example
   * ```ts
   * import { UpdateController } from "@noldova/teamrun-shell-desktop";
   *
   * export const hash: Promise<string> = UpdateController.hashFileAsync("/tmp/TeamRun-linux-x64.AppImage");
   * ```
   */
  public static hashFileAsync(file: string): Promise<string>;

  /**
   * The current state.
   */
  public get status(): UpdateStatus;

  /**
   * Starts: a ready record whose version is newer than the installed one and whose file is the updater's package and
   * still has its SHA-512 shows as Ready, without the network; any other record is removed. Then the automatic checks begin: 30 seconds after the
   * start and then every hour, once, or never, as the followed choice says.
   *
   * @returns A promise that settles once the record is read.
   * @example
   * ```ts
   * import type { UpdateController } from "@noldova/teamrun-shell-desktop";
   *
   * export function startAsync(controller: UpdateController): Promise<void> {
   *   return controller.startAsync();
   * }
   * ```
   */
  public startAsync(): Promise<void>;

  /**
   * Follows the value of `shell.updateChecks`: `Automatic`, `AtStart` or `OnRequest`; any other value counts as
   * `Automatic`.
   *
   * @param choice The setting's value.
   * @example
   * ```ts
   * import type { UpdateController } from "@noldova/teamrun-shell-desktop";
   *
   * export function onlyWhenAsked(controller: UpdateController): void {
   *   controller.follow("OnRequest");
   * }
   * ```
   */
  public follow(choice: JsonValue): void;

  /**
   * Runs the window's action: `Check` starts a check unless one, a download or a ready update rules it out, and
   * `Restart` starts the restart that installs the ready update unless one runs, the controller has none or the
   * application must first move to an Applications folder. A restart clears the reason an earlier one left. A
   * restart that fails leaves the update ready, with its reason, except on a {@link StaleUpdateException}: then the
   * controller removes the ready record and shows the update as failed, so checks run again. Once it holds the lock,
   * a check that finds a usable ready update another desktop of the installation recorded shows it as ready instead
   * of reaching the feed.
   *
   * @param action The action.
   * @returns Whether the action started.
   * @example
   * ```ts
   * import type { UpdateController } from "@noldova/teamrun-shell-desktop";
   *
   * export function check(controller: UpdateController): boolean {
   *   return controller.act("Check");
   * }
   * ```
   */
  public act(action: unknown): boolean;

  /**
   * Posts `shell.updateReady` for the ready version unless this or another desktop posted it before, and records that
   * it was; a call during a post runs it again once the post ends.
   *
   * @returns A promise that settles once it is posted or left for the next connection.
   * @example
   * ```ts
   * import type { UpdateController } from "@noldova/teamrun-shell-desktop";
   *
   * export function notifyAsync(controller: UpdateController): Promise<void> {
   *   return controller.notifyAsync();
   * }
   * ```
   */
  public notifyAsync(): Promise<void>;

  /**
   * Stops the automatic checks, refuses new ones and cancels the download in progress; nothing is published afterwards,
   * a check that was taking the lock reaches no feed, and what a running check or download gives is dropped.
   *
   * @example
   * ```ts
   * import type { UpdateController } from "@noldova/teamrun-shell-desktop";
   *
   * export function stop(controller: UpdateController): void {
   *   controller.stop();
   * }
   * ```
   */
  public stop(): void;
}

/**
 * The exception thrown when an update's handoff cannot install it; its message is the reason the updater shows.
 */
export declare class UpdateHandoffException extends Exception {
  /**
   * The exception's name, `"UpdateHandoffException"`, which the class sets itself so
   * that a minified build keeps it.
   */
  public override readonly name: string;

  /**
   * Creates the exception.
   *
   * @param message Why the handoff failed.
   * @param options The underlying error, if any.
   * @example
   * ```ts
   * import { UpdateHandoffException } from "@noldova/teamrun-shell-desktop";
   *
   * export const failure: UpdateHandoffException = new UpdateHandoffException("The AppImage could not be replaced with the update.");
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a ready update is no longer the one to install: the feed no longer offers its version, or
 * its file no longer matches the ready record. Its message is the reason the updater shows.
 */
export declare class StaleUpdateException extends UpdateHandoffException {
  /**
   * The exception's name, `"StaleUpdateException"`, which the class sets itself so
   * that a minified build keeps it.
   */
  public override readonly name: string;

  /**
   * Creates the exception.
   *
   * @param message Why the update is no longer the one to install.
   * @param options The underlying error, if any.
   * @example
   * ```ts
   * import { StaleUpdateException } from "@noldova/teamrun-shell-desktop";
   *
   * export const failure: StaleUpdateException = new StaleUpdateException("The update feed no longer offers version 1.3.0.");
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when an update cannot stop the installation; its message is the reason the updater shows.
 */
export declare class UpdateStopException extends Exception {
  /**
   * The exception's name, `"UpdateStopException"`, which the class sets itself so
   * that a minified build keeps it.
   */
  public override readonly name: string;

  /**
   * Creates the exception.
   *
   * @param message Why the update stopped.
   * @param options The underlying error, if any.
   * @example
   * ```ts
   * import { UpdateStopException } from "@noldova/teamrun-shell-desktop";
   *
   * export const failure: UpdateStopException = new UpdateStopException("Another update of TeamRun is under way.");
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a window's state cannot be read or kept through the runtime.
 */
export declare class WindowStateException extends Exception {
  /**
   * The exception's name, `"WindowStateException"`, which the class sets itself so
   * that a minified build keeps it.
   */
  public override readonly name: string;

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
   * The exception's name, `"WindowStateUnavailableException"`, which the class sets itself so
   * that a minified build keeps it.
   */
  public override readonly name: string;

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
 * Limits the errors one window's page reports within a fixed period. The period starts with the first error after
 * the previous one has passed; reloading the page does not start a new one.
 */
export declare class WindowErrorLimit {
  /**
   * Creates the limit, with no period started.
   *
   * @param burst The most errors written in one period.
   * @param period The period's length, in milliseconds.
   * @param now Returns the current time in milliseconds; `Date.now` by default.
   * @example
   * ```ts
   * import { WindowErrorLimit } from "@noldova/teamrun-shell-desktop";
   *
   * export const limit: WindowErrorLimit = new WindowErrorLimit(10, 60000);
   * ```
   */
  public constructor(burst: number, period: number, now?: () => number);

  /**
   * Counts one more error and says what becomes of it.
   *
   * @returns The admission: {@link WindowErrorAdmission.Write} for the period's first `burst` errors, {@link WindowErrorAdmission.Notice} for the
   * next one, and {@link WindowErrorAdmission.Drop} for the rest of the period.
   * @example
   * ```ts
   * import { WindowErrorAdmission, type WindowErrorLimit } from "@noldova/teamrun-shell-desktop";
   *
   * export function isWritten(limit: WindowErrorLimit): boolean {
   *   return limit.admit() === WindowErrorAdmission.Write;
   * }
   * ```
   */
  public admit(): WindowErrorAdmission;
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
   * The file whose icon the taskbar shows: a packaged build's program, or a development build's icon file.
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
   * script's, so each checkout has its own taskbar entry and relaunches itself. A packaged build's taskbar shows its
   * program's icon, because the Windows shell cannot read a file inside the app's archive; a development build's shows
   * the icon file.
   *
   * @param isPackaged Whether the build is packaged.
   * @param executablePath The running program.
   * @param iconFile The icon file a development build's taskbar shows.
   * @param mainScript The desktop's main script, which a development build passes to Electron.
   * @param argv The process's command-line arguments.
   * @param workingDirectory The directory relative paths in the arguments resolve against.
   * @returns The identity.
   * @example
   * ```ts
   * import { TaskbarIdentity } from "@noldova/teamrun-shell-desktop";
   *
   * export const identity: TaskbarIdentity = TaskbarIdentity.create(false, "/checkout/electron", "/checkout/assets/icons/icon-dark.ico", "/checkout/main.js", ["--data-dir=data"], "/checkout");
   * ```
   */
  public static create(isPackaged: boolean, executablePath: string, iconFile: string, mainScript: string, argv: readonly string[], workingDirectory: string): TaskbarIdentity;

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
   * @param environment The desktop's own environment, which the utility process gets with `ELECTRON_NO_ATTACH_CONSOLE`
   * set, so that it never attaches to a console the desktop is attached to and the program it starts gets none of that
   * console's handles.
   * @param workingDirectory The folder the utility process, and so the program it starts, starts in, or `null` for
   * Electron's default. Defaults to `null`.
   * @param entryPath The script the utility process runs. Defaults to {@link UtilityProcessStarter.entryPath}.
   * @example
   * ```ts
   * import { type IUtilityProcessHost, UtilityProcessStarter } from "@noldova/teamrun-shell-desktop";
   *
   * export function createStarter(host: IUtilityProcessHost): UtilityProcessStarter {
   *   return new UtilityProcessStarter(host, process.env);
   * }
   * ```
   */
  public constructor(host: IUtilityProcessHost, environment: NodeJS.ProcessEnv, workingDirectory?: string | null, entryPath?: string);

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
   * @param environment The program's environment, which the request carries.
   * @param errorFile The file the program's standard error is appended to.
   * @returns A promise of the started program's process id.
   * @throws LaunchException as a rejection when the utility process cannot start the program or ends without answering.
   * @throws JsonException as a rejection when the answer is not a start reply.
   * @example
   * ```ts
   * import { type IUtilityProcessHost, UtilityProcessStarter } from "@noldova/teamrun-shell-desktop";
   *
   * export function startAsync(host: IUtilityProcessHost, errorFile: string): Promise<number> {
   *   return new UtilityProcessStarter(host, process.env).startAsync(process.execPath, ["--version"], process.env, errorFile);
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
