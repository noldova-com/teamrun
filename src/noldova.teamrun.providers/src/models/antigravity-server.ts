/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExecutableSource } from "../enums/executable-source.js";
import type { ProcessCommand } from "./process-command.js";

export class AntigravityServer {
  public readonly command: ProcessCommand;
  public readonly harnessPath: string;
  public readonly source: ExecutableSource;

  public constructor(command: ProcessCommand, harnessPath: string, source: ExecutableSource = ExecutableSource.Managed) {
    this.command = command;
    this.harnessPath = harnessPath;
    this.source = source;
  }
}
