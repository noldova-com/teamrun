/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, type WritableSignal, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources";
import { VirtualListException } from "../exceptions/virtual-list.exception";
import type { IVirtualListObserver } from "../interfaces/i-virtual-list-observer";
import { VirtualListPageRead } from "../models/virtual-list-page-read";
import type { VirtualListSource } from "../models/virtual-list-source";

export class VirtualListCache<T> implements IVirtualListObserver {
  private readonly source: VirtualListSource<T>;
  private readonly report: (error: unknown) => void;
  private readonly items: Map<number, T> = new Map();
  private readonly stale: Map<number, number> = new Map();
  private readonly loading: Map<number, VirtualListPageRead> = new Map();
  private readonly failed: Set<number> = new Set();
  private readonly changes: WritableSignal<number> = signal(0);
  private wantedStart: number = 0;
  private wantedEnd: number = 0;
  private updates: number = 0;

  public readonly revision: Signal<number> = this.changes.asReadonly();

  public constructor(source: VirtualListSource<T>, report: (error: unknown) => void) {
    this.source = source;
    this.report = report;
    source.observe(this);
  }

  public get size(): number {
    return this.items.size;
  }

  public itemAt(index: number): T | undefined {
    return this.items.get(index);
  }

  public isFailed(index: number): boolean {
    return this.failed.has(Math.floor(index / Resources.virtualListPageSize));
  }

  public findIndex(test: (item: T) => boolean): number {
    for (const [index, item] of this.items)
      if (test(item))
        return index;
    return -1;
  }

  public request(start: number, end: number): void {
    const length = this.source.length();
    const from = Math.min(Math.max(0, start), length);
    const to = Math.min(Math.max(from, end), length);
    const excess = to - from - Resources.virtualListCapacity;
    this.wantedStart = excess > 0 ? from + Math.floor(excess / 2) : from;
    this.wantedEnd = excess > 0 ? this.wantedStart + Resources.virtualListCapacity : to;
    const first = Math.floor(this.wantedStart / Resources.virtualListPageSize);
    const last = Math.ceil(this.wantedEnd / Resources.virtualListPageSize);
    for (const [page, read] of this.loading)
      if (page < first || page >= last) {
        read.controller.abort();
        this.loading.delete(page);
      }
    for (let page = first; page < last; page++)
      if (!this.loading.has(page) && !this.failed.has(page) && this.needsRead(page))
        this.load(page);
    this.evict();
  }

  public retry(): void {
    this.failed.clear();
    this.request(this.wantedStart, this.wantedEnd);
  }

  public dispose(): void {
    for (const read of this.loading.values())
      read.controller.abort();
    this.loading.clear();
    this.source.unobserve(this);
  }

  public onInserted(at: number, count: number): void {
    this.wantedStart = this.wantedStart >= at ? this.wantedStart + count : this.wantedStart;
    this.wantedEnd = Math.max(this.wantedStart, this.wantedEnd > at ? this.wantedEnd + count : this.wantedEnd);
    this.shift(at, t => t >= at ? t + count : t);
  }

  public onRemoved(at: number, count: number): void {
    const move = (t: number): number => t <= at ? t : Math.max(at, t - count);
    this.wantedStart = move(this.wantedStart);
    this.wantedEnd = move(this.wantedEnd);
    this.shift(at, t => t < at ? t : t >= at + count ? t - count : null);
  }

  public onUpdated(at: number, count: number): void {
    this.updates++;
    for (let index = at; index < at + count; index++)
      if (this.items.has(index) || this.loading.has(Math.floor(index / Resources.virtualListPageSize)))
        this.stale.set(index, this.updates);
    this.request(this.wantedStart, this.wantedEnd);
  }

  private needsRead(page: number): boolean {
    const start = Math.max(page * Resources.virtualListPageSize, this.wantedStart);
    const end = Math.min((page + 1) * Resources.virtualListPageSize, this.wantedEnd);
    for (let index = start; index < end; index++)
      if (!this.items.has(index) || this.stale.has(index))
        return true;
    return false;
  }

  private load(page: number): void {
    const start = page * Resources.virtualListPageSize;
    const read = new VirtualListPageRead(start, Math.min(start + Resources.virtualListPageSize, this.source.length()), this.updates);
    this.loading.set(page, read);
    try {
      void this.source.readAsync(read.start, read.end, read.controller.signal).then(
        t => this.receive(page, read, t),
        (error: unknown) => this.fail(page, read, error));
    }
    catch (error) {
      this.fail(page, read, error);
    }
  }

  private receive(page: number, read: VirtualListPageRead, items: readonly T[]): void {
    if (this.loading.get(page) !== read)
      return;
    if (items.length !== read.end - read.start) {
      this.fail(page, read, new VirtualListException(Resources.formatVirtualListReadMismatch(read.start, read.end, items.length)));
      return;
    }
    this.loading.delete(page);
    for (const [offset, item] of items.entries()) {
      const index = read.start + offset;
      this.items.set(index, item);
      const mark = this.stale.get(index);
      if (!Object.isUndefined(mark) && mark <= read.lastUpdate)
        this.stale.delete(index);
    }
    this.changes.update(t => t + 1);
    this.request(this.wantedStart, this.wantedEnd);
  }

  private fail(page: number, read: VirtualListPageRead, error: unknown): void {
    if (this.loading.get(page) !== read)
      return;
    this.loading.delete(page);
    this.failed.add(page);
    this.changes.update(t => t + 1);
    this.report(error);
  }

  private evict(): void {
    const excess = this.items.size - Resources.virtualListCapacity;
    if (excess <= 0)
      return;
    const outside = [...this.items.keys()].filter(t => t < this.wantedStart || t >= this.wantedEnd);
    outside.sort((a, b) => this.distanceOf(b) - this.distanceOf(a));
    for (const index of outside.slice(0, excess)) {
      this.items.delete(index);
      this.stale.delete(index);
    }
  }

  private distanceOf(index: number): number {
    return index < this.wantedStart ? this.wantedStart - index : index - this.wantedEnd + 1;
  }

  private shift(at: number, move: (index: number) => number | null): void {
    const items = [...this.items];
    const stale = [...this.stale];
    this.items.clear();
    this.stale.clear();
    for (const [index, item] of items) {
      const next = move(index);
      if (!Object.isNull(next))
        this.items.set(next, item);
    }
    for (const [index, update] of stale) {
      const next = move(index);
      if (!Object.isNull(next))
        this.stale.set(next, update);
    }
    for (const [page, read] of this.loading)
      if (read.end > at) {
        read.controller.abort();
        this.loading.delete(page);
      }
    for (const page of this.failed)
      if ((page + 1) * Resources.virtualListPageSize > at)
        this.failed.delete(page);
    this.changes.update(t => t + 1);
  }
}
