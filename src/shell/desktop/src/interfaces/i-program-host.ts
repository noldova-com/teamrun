/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { StartedProgram } from "../models/started-program.js";

export interface IProgramHost {
  runAsync(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv): Promise<string>;
  start(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv, onOutput: (text: string) => void, onExit: () => void): StartedProgram;
}
