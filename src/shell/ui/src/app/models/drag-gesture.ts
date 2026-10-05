/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class DragGesture {
  public static readonly threshold: number = 4;

  public static hasStarted(startX: number, startY: number, x: number, y: number): boolean {
    return Math.hypot(x - startX, y - startY) >= DragGesture.threshold;
  }
}
