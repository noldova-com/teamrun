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

export abstract class VirtualListSource<T> {
  private readonly observers: Set<IVirtualListObserver> = new Set();
  private readonly size: WritableSignal<number>;

  public readonly length: Signal<number>;
  public readonly estimate: number;

  public constructor(length: number, estimate: number = Resources.virtualListEstimate) {
    if (!Number.isSafeInteger(length) || length < 0)
      throw new VirtualListException(Resources.formatVirtualListLengthInvalid(length));
    if (!Number.isFinite(estimate) || estimate <= 0)
      throw new VirtualListException(Resources.formatVirtualListEstimateInvalid(estimate));

    this.size = signal(length);
    this.length = this.size.asReadonly();
    this.estimate = estimate;
  }

  public abstract readAsync(start: number, end: number, abort: AbortSignal): Promise<readonly T[]>;

  public abstract keyOf(item: T): string;

  public observe(observer: IVirtualListObserver): void {
    this.observers.add(observer);
  }

  public unobserve(observer: IVirtualListObserver): void {
    this.observers.delete(observer);
  }

  public reportInserted(at: number, count: number): void {
    this.checkInsert(at, count);

    this.size.update(t => t + count);
    this.tell(t => t.onInserted(at, count));
  }

  public reportRemoved(at: number, count: number): void {
    this.checkRange(at, count);

    this.size.update(t => t - count);
    this.tell(t => t.onRemoved(at, count));
  }

  public reportUpdated(at: number, count: number): void {
    this.checkRange(at, count);

    this.tell(t => t.onUpdated(at, count));
  }

  protected checkInsert(at: number, count: number): void {
    if (!Number.isSafeInteger(at) || !Number.isSafeInteger(count) || at < 0 || at > this.length() || count < 1)
      throw new VirtualListException(Resources.formatVirtualListInsertInvalid(at, count, this.length()));
  }

  protected checkRange(at: number, count: number): void {
    if (!Number.isSafeInteger(at) || !Number.isSafeInteger(count) || at < 0 || count < 1 || at + count > this.length())
      throw new VirtualListException(Resources.formatVirtualListRangeInvalid(at, count, this.length()));
  }

  private tell(change: (observer: IVirtualListObserver) => void): void {
    const errors: unknown[] = [];
    for (const observer of this.observers)
      try {
        change(observer);
      }
      catch (error) {
        errors.push(error);
      }
    if (errors.length > 0)
      throw errors[0];
  }
}
