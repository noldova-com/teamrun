/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPreventableEvent } from "@noldova/teamrun-shell-desktop";

export class FakePreventableEvent implements IPreventableEvent {
  public isPrevented: boolean = false;

  public preventDefault(): void {
    this.isPrevented = true;
  }
}
