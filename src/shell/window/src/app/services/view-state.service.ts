/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Injectable, effect, inject } from "@angular/core";

import { LayoutService } from "./layout.service";

@Injectable({ providedIn: "root" })
export class ViewStateService {
  private readonly states: Map<string, object> = new Map();

  public constructor() {
    const layout = inject(LayoutService);
    effect(() => {
      const open = new Set(layout.layout().groups.flatMap(t => t.tabs.map(u => u.key)));
      for (const key of [...this.states.keys()].filter(t => !open.has(t)))
        this.states.delete(key);
    });
  }

  public find<T extends object>(tabKey: string, type: abstract new (...args: never[]) => T): T | null {
    const state = this.states.get(tabKey);
    return state instanceof type ? state : null;
  }

  public keep(tabKey: string, state: object): void {
    this.states.set(tabKey, state);
  }
}
