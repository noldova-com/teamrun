/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPageMessage } from "./i-page-message.ts";
import type { IPageRequest } from "./i-page-request.ts";

export interface IWatchedPage {
  on(event: "console", listener: (message: IPageMessage) => void): unknown;
  on(event: "pageerror", listener: (error: Error) => void): unknown;
  on(event: "request" | "requestfinished" | "requestfailed", listener: (request: IPageRequest) => void): unknown;
  on(event: "domcontentloaded" | "load", listener: () => void): unknown;
  off(event: "console", listener: (message: IPageMessage) => void): unknown;
  off(event: "pageerror", listener: (error: Error) => void): unknown;
  off(event: "request" | "requestfinished" | "requestfailed", listener: (request: IPageRequest) => void): unknown;
  off(event: "domcontentloaded" | "load", listener: () => void): unknown;
}
