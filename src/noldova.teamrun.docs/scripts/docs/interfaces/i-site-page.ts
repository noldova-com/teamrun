/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ISiteConsoleMessage } from "./i-site-console-message.ts";
import type { ISiteResponse } from "./i-site-response.ts";

export interface ISitePage {
  on(event: "console", listener: (message: ISiteConsoleMessage) => void): void;
  on(event: "pageerror", listener: (error: Error) => void): void;
  goto(url: string): Promise<ISiteResponse | null>;
  waitForFunction(expression: string, argument: undefined, options: { readonly timeout: number }): Promise<unknown>;
  evaluate(expression: string): Promise<unknown>;
  setViewportSize(size: { readonly width: number; readonly height: number }): Promise<void>;
  close(): Promise<void>;
}
