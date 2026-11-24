/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ArtboardPlace {
  public readonly x: number | null;
  public readonly y: number | null;
  public readonly width: number | null;
  public readonly height: number | null;

  public constructor(x: number | null, y: number | null, width: number | null, height: number | null) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
}
