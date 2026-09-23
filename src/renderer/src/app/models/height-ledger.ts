/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { VirtualRange } from "./virtual-range";

export class HeightLedger {
  public readonly ids: readonly string[];
  private readonly heights: readonly number[];
  private readonly offsets: readonly number[];
  private readonly indices: ReadonlyMap<string, number>;

  public constructor(ids: readonly string[], measured: ReadonlyMap<string, number>, estimate: number) {
    this.ids = [...ids];
    this.heights = this.ids.map(id => measured.get(id) ?? estimate);
    const offsets: number[] = [0];
    for (const height of this.heights)
      offsets.push((offsets[offsets.length - 1] ?? 0) + height);
    this.offsets = offsets;
    this.indices = new Map(this.ids.map((id, index) => [id, index]));
  }

  public get count(): number {
    return this.ids.length;
  }

  public get total(): number {
    return this.offsets[this.count] ?? 0;
  }

  public offsetOf(id: string): number | null {
    const index = this.indices.get(id);
    return Object.isUndefined(index) ? null : this.offsets[index] ?? null;
  }

  public heightOf(id: string): number | null {
    const index = this.indices.get(id);
    return Object.isUndefined(index) ? null : this.heights[index] ?? null;
  }

  public indexAt(position: number): number {
    if (this.count === 0)
      return 0;
    let low = 0;
    let high = this.count - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if ((this.offsets[middle] ?? 0) <= position)
        low = middle;
      else
        high = middle - 1;
    }
    return low;
  }

  public rangeFor(scrollTop: number, viewport: number, margin: number): VirtualRange {
    if (this.count === 0)
      return VirtualRange.empty;
    const start = this.indexAt(Math.max(0, scrollTop - margin));
    const end = Math.min(this.count, this.indexAt(scrollTop + viewport + margin) + 1);
    return new VirtualRange(start, end, this.offsets[start] ?? 0, this.total - (this.offsets[end] ?? this.total));
  }
}
