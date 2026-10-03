/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, type WritableSignal, computed, signal } from "@angular/core";

import { StatusBarSide } from "../enums/status-bar-side";
import type { StatusBarItem } from "../models/status-bar-item";
import type { TopBarAction } from "../models/top-bar-action";

@Injectable({ providedIn: "root" })
export class BarItemsService {
  private readonly statusBarItemsValue: WritableSignal<readonly StatusBarItem[]> = signal([]);
  private readonly topBarActionsValue: WritableSignal<readonly TopBarAction[]> = signal([]);

  public readonly leftItems: Signal<readonly StatusBarItem[]> = computed(() => this.statusBarItemsValue().filter(t => t.side === StatusBarSide.Left));
  public readonly rightItems: Signal<readonly StatusBarItem[]> = computed(() => this.statusBarItemsValue().filter(t => t.side === StatusBarSide.Right));
  public readonly topBarActions: Signal<readonly TopBarAction[]> = this.topBarActionsValue.asReadonly();

  public set(statusBarItems: readonly StatusBarItem[], topBarActions: readonly TopBarAction[]): void {
    this.statusBarItemsValue.set([...statusBarItems]);
    this.topBarActionsValue.set([...topBarActions]);
  }
}
