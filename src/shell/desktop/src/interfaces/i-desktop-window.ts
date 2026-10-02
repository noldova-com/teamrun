/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TitleBarOverlayOptions } from "electron";

import type { IPreventableEvent } from "./i-preventable-event.js";
import type { IWindowContents } from "./i-window-contents.js";

export interface IDesktopWindow {
  readonly webContents: IWindowContents;

  loadFile(filePath: string): Promise<void>;
  setBackgroundColor(color: string): void;
  setTitleBarOverlay(options: TitleBarOverlayOptions): void;
  isVisible(): boolean;
  isDestroyed(): boolean;
  isMinimized(): boolean;
  show(): void;
  restore(): void;
  focus(): void;
  close(): void;
  on(event: "close", listener: (event: IPreventableEvent) => void): unknown;
  once(event: "closed", listener: () => void): unknown;
}
