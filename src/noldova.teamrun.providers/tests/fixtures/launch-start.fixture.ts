/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SpawnOptions } from "node:child_process";

export class LaunchStart {
  public readonly command: string;
  public readonly args: readonly string[];
  public readonly options: SpawnOptions;

  public constructor(command: string, args: readonly string[], options: SpawnOptions) {
    this.command = command;
    this.args = args;
    this.options = options;
  }
}
