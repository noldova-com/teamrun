/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ViewSizeCase {
  public readonly size: string;
  public readonly width: number;
  public readonly wraps: boolean;

  public constructor(size: string, width: number, wraps: boolean) {
    this.size = size;
    this.width = width;
    this.wraps = wraps;
  }
}
