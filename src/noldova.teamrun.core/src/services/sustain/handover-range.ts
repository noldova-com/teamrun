/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class HandoverRange {
  public readonly from: number;
  public readonly to: number;

  public constructor(from: number, to: number) {
    this.from = from;
    this.to = to;
  }
}
