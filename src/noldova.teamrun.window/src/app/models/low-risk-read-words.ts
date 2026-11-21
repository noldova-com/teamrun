/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class LowRiskReadWords {
  public readonly changed: string;
  public readonly same: string;

  public constructor(changed: string, same: string) {
    this.changed = changed;
    this.same = same;
  }
}
