/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import type { ProcessOrigin } from "./process-origin.js";

export class ProcessCommand {
  public readonly executable: string;
  public readonly arguments: readonly string[];
  public readonly origin: ProcessOrigin | null;
  public readonly isVerbatim: boolean;
  public readonly ownsGroup: boolean;

  public constructor(executable: string, args: readonly string[], origin: ProcessOrigin | null = null, isVerbatim: boolean = false, ownsGroup: boolean = false) {
    ArgumentException.throwIfNullOrWhitespace(executable, Resources.executableParameterName);

    this.executable = executable;
    this.arguments = [...args];
    this.origin = origin;
    this.isVerbatim = isVerbatim;
    this.ownsGroup = ownsGroup;
  }

  public withArguments(...args: readonly string[]): ProcessCommand {
    return new ProcessCommand(this.executable, [...this.arguments, ...args], this.origin, this.isVerbatim, this.ownsGroup);
  }

  public withOrigin(origin: ProcessOrigin): ProcessCommand {
    return new ProcessCommand(this.executable, this.arguments, origin, this.isVerbatim, this.ownsGroup);
  }

  public inOwnGroup(): ProcessCommand {
    return new ProcessCommand(this.executable, this.arguments, this.origin, this.isVerbatim, true);
  }
}
