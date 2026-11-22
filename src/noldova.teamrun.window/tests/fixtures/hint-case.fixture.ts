/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MethodName } from "@noldova/teamrun.protocol";

export class HintCase {
  public readonly hint: string;
  public readonly action: string;
  public readonly method: MethodName;

  public constructor(hint: string, action: string, method: MethodName) {
    this.hint = hint;
    this.action = action;
    this.method = method;
  }
}
