/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessCommand } from "./process-command.js";

export class CodexServerChoice {
  public readonly command: ProcessCommand;
  public readonly download: string | null;

  public constructor(command: ProcessCommand, download: string | null) {
    this.command = command;
    this.download = download;
  }
}
