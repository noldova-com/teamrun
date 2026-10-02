/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export type { IApplicationHost } from "../interfaces/i-application-host.js";
export type { IDesktopWindow } from "../interfaces/i-desktop-window.js";
export type { IElectron } from "../interfaces/i-electron.js";
export type { IIpcEvent } from "../interfaces/i-ipc-event.js";
export type { IIpcHost } from "../interfaces/i-ipc-host.js";
export type { IMenuHost } from "../interfaces/i-menu-host.js";
export type { IPermissionHost } from "../interfaces/i-permission-host.js";
export type { IPreventableEvent } from "../interfaces/i-preventable-event.js";
export type { ISenderFrame } from "../interfaces/i-sender-frame.js";
export type { ISessionHost } from "../interfaces/i-session-host.js";
export type { IWindowContents } from "../interfaces/i-window-contents.js";
export { DesktopSettings } from "../models/desktop-settings.js";
export { ScreenArea } from "../models/screen-area.js";
export { SenderInfo } from "../models/sender-info.js";
export { WindowAppearance } from "../models/window-appearance.js";
export { WindowState } from "../models/window-state.js";
export { CloseCoordinator } from "../services/close-coordinator.js";
export { DesktopApplication } from "../services/desktop-application.js";
export { SenderPolicy } from "../services/sender-policy.js";
