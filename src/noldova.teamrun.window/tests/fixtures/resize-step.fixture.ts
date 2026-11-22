/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ResizeStep {
  public readonly width: number;
  public readonly level: number;

  public constructor(width: number, level: number) {
    this.width = width;
    this.level = level;
  }
}
