/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources.js";

export class SourcePosition {
  public readonly sourcePath: string;
  public readonly line: number;

  public constructor(sourcePath: string, line: number) {
    ArgumentException.throwIfNullOrWhitespace(sourcePath, nameof<SourcePosition>(t => t.sourcePath));
    if (!Number.isInteger(line) || line < 1)
      throw new ArgumentOutOfRangeException(nameof<SourcePosition>(t => t.line), line, Resources.lineInvalid);

    this.sourcePath = sourcePath;
    this.line = line;
  }
}
