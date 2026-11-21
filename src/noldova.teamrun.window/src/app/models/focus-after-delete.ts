/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterNextRender, type Injector } from "@angular/core";

export class FocusAfterDelete {
  public static later(injector: Injector, control: Element | null, target: () => HTMLElement | null, fallback: () => HTMLElement | null): void {
    afterNextRender(() => {
      const active = document.activeElement;
      if (active === document.body || active === control)
        (target() ?? fallback())?.focus();
    }, { injector });
  }
}
