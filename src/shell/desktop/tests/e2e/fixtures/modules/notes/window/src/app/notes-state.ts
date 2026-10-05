/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type WritableSignal, signal } from "@angular/core";

export class NotesState {
  public static readonly sortBy: WritableSignal<string> = signal("week");
  public static readonly wrapsLines: WritableSignal<boolean> = signal(false);
  public static readonly runtime: WritableSignal<string> = signal("");
  public static readonly continued: WritableSignal<number> = signal(0);
}
