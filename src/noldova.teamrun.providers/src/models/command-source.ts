/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { ProcessCommand } from "./process-command.js";

export class CommandSource {
  private command: ProcessCommand | null;
  private readonly locate: () => ProcessCommand | null;

  public constructor(command: ProcessCommand | null, locate: () => ProcessCommand | null = CommandSource.none) {
    this.command = command;
    this.locate = locate;
  }

  public get current(): ProcessCommand | null {
    if (Object.isNull(this.command))
      this.command = this.locate();
    return this.command;
  }

  public static none(): ProcessCommand | null {
    return null;
  }
}
