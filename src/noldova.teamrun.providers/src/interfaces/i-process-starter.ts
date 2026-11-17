/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessCommand } from "../models/process-command.js";
import type { StartedProcess } from "../services/process/started-process.js";

export interface IProcessStarter {
  start(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string | null): StartedProcess;
  readEnvironmentAsync(own: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv>;
}
