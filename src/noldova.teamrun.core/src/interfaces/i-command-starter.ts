/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRunningCommand } from "./i-running-command.js";

export interface ICommandStarter {
  refusalOf(command: string): string | null;
  start(command: string, directory: string, output: (text: string) => void): IRunningCommand;
}
