/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";

import { ReplyExpansion } from "./reply-expansion";

export class MessageControlState {
  private readonly wrapping: Map<number, Set<number>>;

  public readonly activityChoice: WritableSignal<boolean | null>;
  public readonly expansion: ReplyExpansion;

  public constructor() {
    this.wrapping = new Map();
    this.activityChoice = signal(null);
    this.expansion = new ReplyExpansion();
  }

  public get hasChanges(): boolean {
    return !Object.isNull(this.activityChoice()) || this.expansion.hasChanges || [...this.wrapping.values()].some(t => t.size > 0);
  }

  public wrappingFor(sequence: number): Set<number> {
    let wrapped = this.wrapping.get(sequence);
    if (Object.isUndefined(wrapped)) {
      wrapped = new Set();
      this.wrapping.set(sequence, wrapped);
    }
    return wrapped;
  }
}
