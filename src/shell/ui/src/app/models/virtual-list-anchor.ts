/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class VirtualListAnchor {
  public readonly index: number;
  public readonly distance: number;

  public constructor(index: number, distance: number) {
    this.index = index;
    this.distance = distance;
  }

  public afterInsert(at: number, count: number): VirtualListAnchor {
    return at <= this.index ? new VirtualListAnchor(this.index + count, this.distance) : this;
  }

  public afterRemove(at: number, count: number): VirtualListAnchor {
    if (at + count <= this.index)
      return new VirtualListAnchor(this.index - count, this.distance);
    return at <= this.index ? new VirtualListAnchor(at, 0) : this;
  }
}
