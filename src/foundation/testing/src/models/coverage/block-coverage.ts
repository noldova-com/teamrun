/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "@noldova/teamrun-foundation-core";
import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources.js";

export class BlockCoverage {
  public readonly line: number;
  public readonly isTaken: boolean;

  public constructor(line: number, isTaken: boolean) {
    if (!Number.isInteger(line) || line < 1)
      throw new ArgumentOutOfRangeException(nameof<BlockCoverage>(t => t.line), line, Resources.lineInvalid);

    this.line = line;
    this.isTaken = isTaken;
  }
}
