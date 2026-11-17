/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessCommand } from "./process-command.js";

export class AcpLaunch {
  public readonly command: ProcessCommand;
  public readonly environment: NodeJS.ProcessEnv;
  public readonly directory: string;

  public constructor(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string) {
    this.command = command;
    this.environment = environment;
    this.directory = directory;
  }
}
