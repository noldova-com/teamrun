/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class HoldRefusal {
  public readonly exit: number;
  public readonly reason: string;

  public constructor(exit: number, reason: string) {
    this.exit = exit;
    this.reason = reason;
  }
}
