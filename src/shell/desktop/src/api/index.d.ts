/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BrowserWindowConstructorOptions, MenuItemConstructorOptions, TitleBarOverlayOptions, WindowOpenHandlerResponse } from "electron";

import type { JsonObject } from "@noldova/teamrun-foundation-json";

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
   * Listens for a lifecycle event: another instance starting, the last window closing or the application being
   * activated.
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
}

/**
 * A native window, as Electron's `BrowserWindow` provides it.
 */
export interface IDesktopWindow {
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
   * Listens for the window being asked to close; the listener may cancel it.
   *
   * @param event The event's name.
   * @param listener Receives the cancellable event.
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
 * The desktop's main process: one sandboxed instance with one window, which it shows once the page has painted its
 * theme and closes once the page has saved.
 */
export declare class DesktopApplication {
  private constructor();

  /**
   * Starts the desktop: claims the single-instance lock, then opens the window when Electron is ready.
   *
   * @param electron Electron's main-process API.
   * @param moduleUrl The URL of the desktop's compiled entry point, which locates the window and the preload.
   * @param platform The operating system, as Node.js names it.
   * @example
   * ```ts
   * import { DesktopApplication, type IElectron } from "@noldova/teamrun-shell-desktop";
   *
   * export function launch(electron: IElectron): void {
   *   DesktopApplication.start(electron, "file:///repository/node_modules/@noldova/teamrun-shell-desktop/main.js", "linux");
   * }
   * ```
   */
  public static start(electron: IElectron, moduleUrl: string, platform: string): void;
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
