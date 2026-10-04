/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Directive, type WritableSignal, effect, input, signal } from "@angular/core";

import { Resources } from "../../../resources";

@Directive({
  host: {
    "[class.tr-reveal-pending]": "isPending()"
  }
})
export class RevealDelayDirective {
  private readonly pending: WritableSignal<boolean> = signal(false);

  public readonly isDelayed = input<boolean>(false);
  public readonly isPending = this.pending.asReadonly();

  public constructor() {
    effect(onCleanup => {
      if (!this.isDelayed()) {
        this.pending.set(false);
        return;
      }
      this.pending.set(true);
      const timer = setTimeout(() => this.pending.set(false), Resources.revealDelay);
      onCleanup(() => clearTimeout(timer));
    });
  }
}
