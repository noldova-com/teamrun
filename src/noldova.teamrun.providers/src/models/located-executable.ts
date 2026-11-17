/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";

import type { ExecutableSource } from "../enums/executable-source.js";
import { Resources } from "../resources.js";
import { ProcessCommand } from "./process-command.js";

export class LocatedExecutable {
  public readonly path: string;
  public readonly source: ExecutableSource;
  public readonly arguments: readonly string[];

  public constructor(path: string, source: ExecutableSource, args: readonly string[] = []) {
    ArgumentException.throwIfNullOrWhitespace(path, Resources.pathParameterName);

    this.path = path;
    this.source = source;
    this.arguments = [...args];
  }

  public toCommand(): ProcessCommand {
    return new ProcessCommand(this.path, this.arguments);
  }
}
