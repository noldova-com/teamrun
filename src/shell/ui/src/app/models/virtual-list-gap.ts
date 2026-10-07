/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class VirtualListGap {
  public readonly isFailed: boolean;
  public readonly isAtStart: boolean;

  public constructor(isFailed: boolean, isAtStart: boolean) {
    this.isFailed = isFailed;
    this.isAtStart = isAtStart;
  }
}
