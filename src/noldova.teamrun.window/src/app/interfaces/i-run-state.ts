/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalRun } from "@noldova/terminal.window";
import type { ShellRunState } from "@noldova/ui.components.angular";

import type { IRunPlace } from "./i-run-place";

export interface IRunState {
  readonly place: IRunPlace;
  readonly run: TerminalRun;
  readonly state: ShellRunState;
}
