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
import type { VirtualListSource } from "../models/virtual-list-source";

export class VirtualListCache<T> implements IVirtualListObserver {
  private readonly source: VirtualListSource<T>;
  private readonly report: (error: unknown) => void;
  private readonly pageSize: number;
  private readonly capacity: number;
  private readonly items: Map<number, T> = new Map();
  private readonly loading: Map<number, AbortController> = new Map();
  private readonly failed: Set<number> = new Set();
  private readonly changes: WritableSignal<number> = signal(0);
  private wantedStart: number = 0;
  private wantedEnd: number = 0;

  public readonly revision: Signal<number> = this.changes.asReadonly();

  public constructor(
    source: VirtualListSource<T>,
    report: (error: unknown) => void,
    pageSize: number = Resources.virtualListPageSize,
    capacity: number = Resources.virtualListCapacity) {
    this.source = source;
    this.report = report;
    this.pageSize = pageSize;
    this.capacity = capacity;
    source.observe(this);
  }

  public get hasFailed(): boolean {
    return this.failed.size > 0;
  }

  public get size(): number {
    return this.items.size;
  }

  public itemAt(index: number): T | undefined {
    return this.items.get(index);
  }

  public isFailed(index: number): boolean {
    return this.failed.has(Math.floor(index / this.pageSize));
  }

  public findIndex(test: (item: T) => boolean): number {
    for (const [index, item] of this.items)
      if (test(item))
        return index;
    return -1;
  }

  public request(start: number, end: number): void {
    this.wantedStart = start;
    this.wantedEnd = Math.min(end, this.source.length());
    const first = Math.floor(this.wantedStart / this.pageSize);
    const last = Math.ceil(this.wantedEnd / this.pageSize);
    for (const [page, controller] of this.loading)
      if (page < first || page >= last) {
        controller.abort();
        this.loading.delete(page);
      }
    for (let page = first; page < last; page++)
      if (!this.loading.has(page) && !this.failed.has(page) && !this.isLoaded(page))
        this.load(page);
    this.evict();
  }

  public retry(): void {
    this.failed.clear();
    this.request(this.wantedStart, this.wantedEnd);
  }

  public dispose(): void {
    this.abortAll();
    this.source.unobserve(this);
  }

  public onInserted(at: number, count: number): void {
    this.shift(t => t >= at ? t + count : t);
  }

  public onRemoved(at: number, count: number): void {
    this.shift(t => t < at ? t : t >= at + count ? t - count : null);
  }

  public onUpdated(at: number, count: number): void {
    this.shift(t => t >= at && t < at + count ? null : t);
  }

  private isLoaded(page: number): boolean {
    const start = page * this.pageSize;
    const end = Math.min(start + this.pageSize, this.source.length());
    for (let index = start; index < end; index++)
      if (!this.items.has(index))
        return false;
    return true;
  }

  private load(page: number): void {
    const controller = new AbortController();
    const start = page * this.pageSize;
    const end = Math.min(start + this.pageSize, this.source.length());
    this.loading.set(page, controller);
    void this.source.readAsync(start, end, controller.signal).then(
      t => this.receive(page, controller, start, end, t),
      (error: unknown) => this.fail(page, controller, error));
  }

  private receive(page: number, controller: AbortController, start: number, end: number, items: readonly T[]): void {
    if (this.loading.get(page) !== controller)
      return;
    if (items.length !== end - start) {
      this.fail(page, controller, new VirtualListException(Resources.formatVirtualListReadMismatch(start, end, items.length)));
      return;
    }
    this.loading.delete(page);
    for (const [offset, item] of items.entries())
      this.items.set(start + offset, item);
    this.evict();
    this.changes.update(t => t + 1);
  }

  private fail(page: number, controller: AbortController, error: unknown): void {
    if (this.loading.get(page) !== controller)
      return;
    this.loading.delete(page);
    this.failed.add(page);
    this.changes.update(t => t + 1);
    this.report(error);
  }

  private evict(): void {
    const excess = this.items.size - this.capacity;
    if (excess <= 0)
      return;
    const outside = [...this.items.keys()].filter(t => t < this.wantedStart || t >= this.wantedEnd);
    outside.sort((a, b) => this.distanceOf(b) - this.distanceOf(a));
    for (const index of outside.slice(0, excess))
      this.items.delete(index);
  }

  private distanceOf(index: number): number {
    return index < this.wantedStart ? this.wantedStart - index : index - this.wantedEnd + 1;
  }

  private shift(move: (index: number) => number | null): void {
    const entries = [...this.items];
    this.items.clear();
    for (const [index, item] of entries) {
      const next = move(index);
      if (!Object.isNull(next))
        this.items.set(next, item);
    }
    this.abortAll();
    this.failed.clear();
    this.changes.update(t => t + 1);
  }

  private abortAll(): void {
    for (const controller of this.loading.values())
      controller.abort();
    this.loading.clear();
  }
}
