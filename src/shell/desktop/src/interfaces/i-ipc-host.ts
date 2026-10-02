/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IIpcEvent } from "./i-ipc-event.js";

export interface IIpcHost {
  on(channel: string, listener: (event: IIpcEvent, ...values: unknown[]) => void): unknown;
  handle(channel: string, listener: (event: IIpcEvent, ...values: unknown[]) => unknown): void;
}
