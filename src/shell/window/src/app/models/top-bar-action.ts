/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, type WritableSignal, signal } from "@angular/core";

import type { TopBarActionContribution } from "./top-bar-action-contribution";
import type { TopBarActionState } from "./top-bar-action-state";

export class TopBarAction {
  private readonly stateValue: WritableSignal<TopBarActionState>;
  private readonly check: (state: TopBarActionState) => void;

  public readonly name: string;
  public readonly state: Signal<TopBarActionState>;

  public constructor(contribution: TopBarActionContribution, check: (state: TopBarActionState) => void) {
    check(contribution.state);

    this.check = check;
    this.name = contribution.name;
    this.stateValue = signal(contribution.state);
    this.state = this.stateValue.asReadonly();
  }

  public update(state: TopBarActionState): void {
    this.check(state);
    this.stateValue.set(state);
  }
}
