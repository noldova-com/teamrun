/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CommandExit } from "../models/command-exit.js";

export interface IRunningCommand {
  readonly exited: Promise<CommandExit>;
  stopAsync(): Promise<void>;
}
