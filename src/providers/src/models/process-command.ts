/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class ProcessCommand {
  public readonly executable: string;
  public readonly arguments: readonly string[];

  public constructor(executable: string, args: readonly string[]) {
    ArgumentException.throwIfNullOrWhitespace(executable, Resources.executableParameterName);

    this.executable = executable;
    this.arguments = [...args];
  }

  public withArguments(...args: readonly string[]): ProcessCommand {
    return new ProcessCommand(this.executable, [...this.arguments, ...args]);
  }
}
