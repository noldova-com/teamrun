/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, type WritableSignal, signal } from "@angular/core";

import type { StatusBarSide } from "../enums/status-bar-side";
import type { StatusBarItemContribution } from "./status-bar-item-contribution";
import type { StatusBarItemState } from "./status-bar-item-state";

export class StatusBarItem {
  private readonly stateValue: WritableSignal<StatusBarItemState>;
  private readonly check: (state: StatusBarItemState) => void;

  public readonly name: string;
  public readonly side: StatusBarSide;
  public readonly state: Signal<StatusBarItemState>;

  public constructor(contribution: StatusBarItemContribution, check: (state: StatusBarItemState) => void) {
    check(contribution.state);

    this.check = check;
    this.name = contribution.name;
    this.side = contribution.side;
    this.stateValue = signal(contribution.state);
    this.state = this.stateValue.asReadonly();
  }

  public update(state: StatusBarItemState): void {
    this.check(state);
    this.stateValue.set(state);
  }
}
