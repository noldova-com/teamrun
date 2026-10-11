/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ICheck from "./interfaces/i-check.ts";

export default class GateCheck {
  public readonly check: ICheck;
  public readonly part: string;
  public readonly runner: string | null;

  public constructor(check: ICheck, part: string, runner: string | null) {
    this.check = check;
    this.part = part;
    this.runner = runner;
  }
}
