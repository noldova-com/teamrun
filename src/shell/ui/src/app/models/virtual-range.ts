/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class VirtualRange {
  public static readonly empty: VirtualRange = new VirtualRange(0, 0, 0, 0);

  public readonly start: number;
  public readonly end: number;
  public readonly top: number;
  public readonly bottom: number;

  public constructor(start: number, end: number, top: number, bottom: number) {
    this.start = start;
    this.end = end;
    this.top = top;
    this.bottom = bottom;
  }

  public equals(other: VirtualRange): boolean {
    return this.start === other.start && this.end === other.end && this.top === other.top && this.bottom === other.bottom;
  }
}
