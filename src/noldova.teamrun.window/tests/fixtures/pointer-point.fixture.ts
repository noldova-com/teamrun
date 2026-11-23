/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PointerPoint {
  public readonly clientX: number;
  public readonly clientY: number;

  public constructor(clientX: number, clientY: number) {
    this.clientX = clientX;
    this.clientY = clientY;
  }
}
