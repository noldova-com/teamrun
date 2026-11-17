/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { StartedProcess } from "../services/process/started-process.js";
import type { IAcpTerminalExit } from "./i-acp-terminal-exit.js";

export interface IAcpTerminal {
  readonly command: string;
  readonly process: StartedProcess;
  readonly launched: number;
  startedBy: number | null;
  readonly limit: number;
  readonly exited: Promise<IAcpTerminalExit>;
  output: string;
  truncated: boolean;
  exit: IAcpTerminalExit | null;
  isTask: boolean;
  stopping: boolean;
  released: boolean;
}
