/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class VirtualListChoice<T> {
  public readonly index: number;
  public readonly item: T;

  public constructor(index: number, item: T) {
    this.index = index;
    this.item = item;
  }
}
