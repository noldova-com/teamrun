/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

export class VirtualListAnchor {
  public readonly index: number;
  public readonly distance: number;
  public readonly key: string | null;

  public constructor(index: number, distance: number, key: string | null = null) {
    this.index = index;
    this.distance = distance;
    this.key = key;
  }

  public afterInsert(at: number, count: number): VirtualListAnchor {
    return at <= this.index ? new VirtualListAnchor(this.index + count, this.distance, this.key) : this;
  }

  public afterRemove(at: number, count: number): VirtualListAnchor {
    if (at + count <= this.index)
      return new VirtualListAnchor(this.index - count, this.distance, this.key);
    return at <= this.index ? new VirtualListAnchor(at, 0) : this;
  }

  public resolve(indexOf: (key: string) => number): VirtualListAnchor {
    const index = Object.isNull(this.key) ? -1 : indexOf(this.key);
    return index < 0 ? this : new VirtualListAnchor(index, this.distance, this.key);
  }
}
