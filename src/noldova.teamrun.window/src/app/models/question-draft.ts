/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";

import "@noldova/context.core";

export class QuestionDraft {
  public readonly picks: WritableSignal<ReadonlyMap<string, readonly string[]>> = signal(new Map());
  public readonly texts: WritableSignal<ReadonlyMap<string, string>> = signal(new Map());

  public get hasChanges(): boolean {
    return [...this.picks().values()].some(t => t.length > 0) || [...this.texts().values()].some(t => t.length > 0);
  }
}
