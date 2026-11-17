/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalRunOutput } from "@noldova/terminal.window";

import type { IRunPlace } from "./i-run-place";

export interface IStoredRun {
  readonly place: IRunPlace;
  readonly output: TerminalRunOutput;
}
