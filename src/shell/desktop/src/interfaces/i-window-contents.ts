/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { RenderProcessGoneDetails, WindowOpenHandlerResponse } from "electron";

import type { IContextMenuParams } from "./i-context-menu-params.js";
import type { IPreventableEvent } from "./i-preventable-event.js";

export interface IWindowContents {
  readonly id: number;

  on(event: "will-navigate", listener: (event: IPreventableEvent, url: string) => void): unknown;
  on(event: "will-redirect", listener: (event: IPreventableEvent, url: string) => void): unknown;
  on(event: "will-attach-webview", listener: (event: IPreventableEvent) => void): unknown;
  on(event: "render-process-gone", listener: (event: unknown, details: RenderProcessGoneDetails) => void): unknown;
  on(event: "did-start-loading", listener: () => void): unknown;
  on(event: "context-menu", listener: (event: unknown, params: IContextMenuParams) => void): unknown;
  setWindowOpenHandler(handler: () => WindowOpenHandlerResponse): void;
  send(channel: string, ...values: unknown[]): void;
  isLoading(): boolean;
  isCrashed(): boolean;
  reload(): void;
  forcefullyCrashRenderer(): void;
  undo(): void;
  redo(): void;
  cut(): void;
  copy(): void;
  paste(): void;
  selectAll(): void;
  replaceMisspelling(text: string): void;
  getOSProcessId(): number;
}
