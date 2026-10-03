/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, type WritableSignal, signal } from "@angular/core";

@Injectable({ providedIn: "root" })
export class TabStripService {
  private readonly overflowingValue: WritableSignal<ReadonlySet<number>> = signal(new Set());
  private readonly listRequestValue: WritableSignal<number | null> = signal(null);

  public readonly listRequest: Signal<number | null> = this.listRequestValue.asReadonly();

  public isOverflowing(groupId: number): boolean {
    return this.overflowingValue().has(groupId);
  }

  public setOverflowing(groupId: number, isOverflowing: boolean): void {
    this.overflowingValue.update(t => {
      const next = new Set(t);
      if (isOverflowing)
        next.add(groupId);
      else
        next.delete(groupId);
      return next;
    });
  }

  public showList(groupId: number): void {
    this.listRequestValue.set(groupId);
  }

  public takeListRequest(groupId: number): boolean {
    if (this.listRequestValue() !== groupId)
      return false;
    this.listRequestValue.set(null);
    return true;
  }
}
