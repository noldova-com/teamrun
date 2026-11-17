/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalShellKind } from "@noldova/terminal.window";

import type { IRunPlace } from "./i-run-place";

export interface IBusyRun {
  readonly place: IRunPlace;
  readonly command: string;
  readonly folder: string | null;
  readonly shellKinds: readonly TerminalShellKind[];
}
