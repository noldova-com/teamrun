/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class RowPair {
  public readonly above: HTMLElement;
  public readonly below: HTMLElement;

  public constructor(above: HTMLElement, below: HTMLElement) {
    this.above = above;
    this.below = below;
  }
}
