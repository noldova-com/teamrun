/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { EnvironmentInjector, Injectable, afterNextRender, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import type { Tab } from "../models/layout/tab";
import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class TabFocusService {
  private readonly document: Document = inject(DOCUMENT);
  private readonly environment: EnvironmentInjector = inject(EnvironmentInjector);

  public focus(tab: Tab): void {
    afterNextRender(() => this.elementOf(tab)?.focus(), { injector: this.environment });
  }

  public focusIfLost(tab: Tab): void {
    afterNextRender(() => {
      const active = this.document.activeElement;
      if (Object.isNull(active) || active === this.document.body)
        this.elementOf(tab)?.focus();
    }, { injector: this.environment });
  }

  private elementOf(tab: Tab): HTMLElement | undefined {
    return [...this.document.querySelectorAll<HTMLElement>(Resources.tabKeySelector)].find(t => t.dataset[Resources.tabKeyData] === tab.key);
  }
}
