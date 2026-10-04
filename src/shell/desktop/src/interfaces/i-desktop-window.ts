/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AppDetailsOptions, Rectangle, TitleBarOverlayOptions } from "electron";

import type { IPreventableEvent } from "./i-preventable-event.js";
import type { IWindowContents } from "./i-window-contents.js";

export interface IDesktopWindow {
  readonly id: number;
  readonly webContents: IWindowContents;

  loadFile(filePath: string): Promise<void>;
  setBackgroundColor(color: string): void;
  setTitleBarOverlay(options: TitleBarOverlayOptions): void;
  setAppDetails(options: AppDetailsOptions): void;
  getNormalBounds(): Rectangle;
  setBounds(bounds: Partial<Rectangle>): void;
  isMaximized(): boolean;
  maximize(): void;
  isVisible(): boolean;
  isDestroyed(): boolean;
  isMinimized(): boolean;
  isFocused(): boolean;
  show(): void;
  restore(): void;
  focus(): void;
  close(): void;
  on(event: "close", listener: (event: IPreventableEvent) => void): unknown;
  on(event: "resize", listener: () => void): unknown;
  on(event: "move", listener: () => void): unknown;
  on(event: "maximize", listener: () => void): unknown;
  on(event: "unmaximize", listener: () => void): unknown;
  on(event: "unresponsive", listener: () => void): unknown;
  on(event: "responsive", listener: () => void): unknown;
  once(event: "closed", listener: () => void): unknown;
}
