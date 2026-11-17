/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalRun, TerminalRunOutput, TerminalRunTarget, TerminalShellKind } from "@noldova/terminal.window";

export interface IRunStarter {
  startRunAsync(owner: string, command: string, folder: string | null, shellKinds: readonly TerminalShellKind[], target: TerminalRunTarget | null,
    shown?: ((sessionId: string) => void) | null): Promise<TerminalRun>;
  readRunOutputAsync(run: TerminalRun, maximumLines?: number): Promise<TerminalRunOutput>;
}
