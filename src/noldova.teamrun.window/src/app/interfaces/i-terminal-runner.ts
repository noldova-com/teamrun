/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalShellKind } from "@noldova/terminal.window";

export interface ITerminalRunner {
  runAsync(owner: string, command: string, folder: string | null, shellKinds: readonly TerminalShellKind[]): Promise<string>;
}
