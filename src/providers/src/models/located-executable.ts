/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import type { ExecutableSource } from "../enums/executable-source.js";
import { Resources } from "../resources.js";
import { ProcessCommand } from "./process-command.js";

export class LocatedExecutable {
  public readonly path: string;
  public readonly source: ExecutableSource;

  public constructor(path: string, source: ExecutableSource) {
    ArgumentException.throwIfNullOrWhitespace(path, Resources.pathParameterName);

    this.path = path;
    this.source = source;
  }

  public toCommand(): ProcessCommand {
    return new ProcessCommand(this.path, []);
  }
}
