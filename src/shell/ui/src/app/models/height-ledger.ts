/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { VirtualListAnchor } from "./virtual-list-anchor";
import { VirtualRange } from "./virtual-range";

export class HeightLedger {
  private readonly estimate: number;
  private readonly offsets: number[] = [0];
  private measured: (number | undefined)[];
  private end: number = 0;

  public constructor(count: number, estimate: number) {
    this.estimate = estimate;
    this.measured = new Array<number | undefined>(count);
  }

  public get count(): number {
    return this.measured.length;
  }

  public get total(): number {
    return this.offsetOf(this.count);
  }

  public offsetOf(index: number): number {
    return this.offsets[index] ?? this.settle(index);
  }

  public heightOf(index: number): number {
    return this.measured[index] ?? this.estimate;
  }

  public indexAt(position: number): number {
    this.settle(this.count);
    let low = 0;
    let high = Math.max(0, this.count - 1);
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (this.offsetOf(middle) <= position)
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
    return new VirtualRange(start, end, this.offsetOf(start), this.total - this.offsetOf(end));
  }

  public anchorAt(scrollTop: number): VirtualListAnchor {
    if (this.count === 0)
      return new VirtualListAnchor(0, 0);
    const index = this.indexAt(scrollTop);
    return new VirtualListAnchor(index, scrollTop - this.offsetOf(index));
  }

  public topOf(anchor: VirtualListAnchor): number {
    return this.offsetOf(Math.min(anchor.index, this.count)) + anchor.distance;
  }

  public measure(index: number, height: number): boolean {
    if (this.measured[index] === height)
      return false;
    this.measured[index] = height;
    this.unsettle(index);
    return true;
  }

  public insert(at: number, count: number): void {
    this.measured = this.measured.slice(0, at).concat(new Array<number | undefined>(count), this.measured.slice(at));
    this.unsettle(at);
  }

  public remove(at: number, count: number): void {
    this.measured.splice(at, count);
    this.unsettle(at);
  }

  private unsettle(index: number): void {
    if (index >= this.offsets.length - 1)
      return;
    this.offsets.length = index + 1;
    this.end = this.offsetOf(index);
  }

  private settle(index: number): number {
    for (let at = this.offsets.length - 1; at < index; at++) {
      this.end += this.heightOf(at);
      this.offsets.push(this.end);
    }
    return this.end;
  }
}
