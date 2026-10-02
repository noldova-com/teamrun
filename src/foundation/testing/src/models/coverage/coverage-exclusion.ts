/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

export class CoverageExclusion {
  public readonly relativePath: string;
  public readonly reason: string;

  public constructor(relativePath: string, reason: string) {
    ArgumentException.throwIfNullOrWhitespace(relativePath, nameof<CoverageExclusion>(t => t.relativePath));
    ArgumentException.throwIfNullOrWhitespace(reason, nameof<CoverageExclusion>(t => t.reason));

    this.relativePath = relativePath;
    this.reason = reason;
  }
}
