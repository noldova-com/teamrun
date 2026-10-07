/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { VirtualListSource } from "./virtual-list-source";

export class ArrayVirtualListSource<T> extends VirtualListSource<T> {
  private readonly keys: (item: T) => string;
  private items: readonly T[];

  public constructor(items: readonly T[], keyOf: (item: T) => string, estimate?: number) {
    super(items.length, estimate);

    this.keys = keyOf;
    this.items = [...items];
  }

  public readAsync(start: number, end: number): Promise<readonly T[]> {
    return Promise.resolve(this.items.slice(start, end));
  }

  public keyOf(item: T): string {
    return this.keys(item);
  }

  public insert(at: number, items: readonly T[]): void {
    this.checkInsert(at, items.length);
    this.items = this.items.slice(0, at).concat(items, this.items.slice(at));
    this.reportInserted(at, items.length);
  }

  public remove(at: number, count: number): void {
    this.checkRange(at, count);
    this.items = this.items.slice(0, at).concat(this.items.slice(at + count));
    this.reportRemoved(at, count);
  }

  public replace(at: number, items: readonly T[]): void {
    this.checkRange(at, items.length);
    this.items = this.items.slice(0, at).concat(items, this.items.slice(at + items.length));
    this.reportUpdated(at, items.length);
  }
}
