/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WindowOpenHandlerResponse } from "electron";

import type { IPreventableEvent } from "./i-preventable-event.js";

export interface IWindowContents {
  readonly id: number;

  on(event: "will-navigate", listener: (event: IPreventableEvent, url: string) => void): unknown;
  on(event: "will-redirect", listener: (event: IPreventableEvent, url: string) => void): unknown;
  on(event: "will-attach-webview", listener: (event: IPreventableEvent) => void): unknown;
  setWindowOpenHandler(handler: () => WindowOpenHandlerResponse): void;
  send(channel: string, ...values: unknown[]): void;
}
