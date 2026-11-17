/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Readable, Writable } from "node:stream";

export interface ISharedMcpLauncherHost {
  readonly pid: number;
  readonly ppid: number;
  readonly stdin: Readable;
  readonly stderr: Writable;
  exit(code: number): void;
  kill(processId: number, signal: NodeJS.Signals): void;
  on(signal: NodeJS.Signals, listener: (signal: NodeJS.Signals) => void): unknown;
  off(signal: NodeJS.Signals, listener: (signal: NodeJS.Signals) => void): unknown;
}
