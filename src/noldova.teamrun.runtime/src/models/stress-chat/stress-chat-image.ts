/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class StressChatImage {
  public readonly name: string;
  public readonly width: number;
  public readonly height: number;
  public readonly isTransparent: boolean;

  public constructor(name: string, width: number, height: number, isTransparent: boolean) {
    this.name = name;
    this.width = width;
    this.height = height;
    this.isTransparent = isTransparent;
  }
}
