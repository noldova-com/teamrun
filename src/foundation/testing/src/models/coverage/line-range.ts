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

export class LineRange {
  public readonly startLine: number;
  public readonly endLine: number;
  public readonly displayText: string;

  public constructor(startLine: number, endLine: number) {
    if (!Number.isInteger(startLine) || startLine < 1)
      throw new ArgumentOutOfRangeException(nameof<LineRange>(t => t.startLine), startLine, Resources.startLineInvalid);

    if (!Number.isInteger(endLine) || endLine < startLine)
      throw new ArgumentOutOfRangeException(nameof<LineRange>(t => t.endLine), endLine, Resources.endLineInvalid);

    this.startLine = startLine;
    this.endLine = endLine;
    this.displayText = this.startLine === this.endLine ? `${this.startLine}` : `${this.startLine}-${this.endLine}`;
  }
}
