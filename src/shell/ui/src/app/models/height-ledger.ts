/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources";
import { VirtualListException } from "../exceptions/virtual-list.exception";
import { VirtualListAnchor } from "./virtual-list-anchor";
import { VirtualRange } from "./virtual-range";

export class HeightLedger {
  private readonly estimate: number;
  private readonly offsets: number[] = [0];
  private readonly measured: (number | undefined)[];
  private end: number = 0;
  private sum: number;

  public constructor(count: number, estimate: number) {
    this.estimate = estimate;
    this.measured = new Array<number | undefined>(count);
    this.sum = count * estimate;
  }

  public get count(): number {
    return this.measured.length;
  }

  public get total(): number {
    return this.sum;
  }

  public offsetOf(index: number): number {
    const at = Math.min(Math.max(0, index), this.count);
    return this.offsets[at] ?? this.settle(at);
  }

  public heightOf(index: number): number {
    return this.measured[index] ?? this.estimate;
  }

  public indexAt(position: number): number {
    const last = Math.max(0, this.count - 1);
    while (this.offsets.length <= last && this.end <= position)
      this.settle(this.offsets.length);
    let low = 0;
    let high = Math.min(last, this.offsets.length - 1);
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
    return new VirtualRange(start, end, this.offsetOf(start), Math.max(0, this.total - this.offsetOf(end)));
  }

  public anchorAt(scrollTop: number): VirtualListAnchor {
    if (this.count === 0)
      return new VirtualListAnchor(0, 0);
    const index = this.indexAt(scrollTop);
    return new VirtualListAnchor(index, scrollTop - this.offsetOf(index));
  }

  public topOf(anchor: VirtualListAnchor): number {
    return this.offsetOf(anchor.index) + anchor.distance;
  }

  public measure(index: number, height: number): boolean {
    if (!Number.isFinite(height) || height < 0)
      throw new VirtualListException(Resources.formatVirtualListHeightInvalid(height));
    if (!Number.isInteger(index) || index < 0 || index >= this.count || this.measured[index] === height)
      return false;
    this.sum += height - this.heightOf(index);
    this.measured[index] = height;
    this.unsettle(index);
    return true;
  }

  public insert(at: number, count: number): void {
    const length = this.count;
    this.measured.length = length + count;
    this.measured.copyWithin(at + count, at, length);
    this.measured.fill(undefined, at, at + count);
    this.sum += count * this.estimate;
    this.unsettle(at);
  }

  public remove(at: number, count: number): void {
    for (const height of this.measured.splice(at, count))
      this.sum -= height ?? this.estimate;
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
