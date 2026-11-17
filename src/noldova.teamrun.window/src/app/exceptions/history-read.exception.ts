/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources";
import { WindowException } from "./window.exception";

export class HistoryReadException extends WindowException {
  public override readonly name: string = "HistoryReadException";
  public readonly start: number;
  public readonly end: number;

  public constructor(start: number, end: number) {
    super(Resources.formatHistoryReadMismatch(start, end));
    this.start = start;
    this.end = end;
  }
}
