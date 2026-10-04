/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Tab } from "./layout/tab";
import type { TabGroup } from "./layout/tab-group";

export class TabTarget {
  public readonly tab: Tab;
  public readonly group: TabGroup;
  public readonly canSplit: boolean;

  public constructor(tab: Tab, group: TabGroup, canSplit: boolean) {
    this.tab = tab;
    this.group = group;
    this.canSplit = canSplit;
  }

  public get index(): number {
    return this.group.tabs.findIndex(t => t.equals(this.tab));
  }

  public get isFirst(): boolean {
    return this.index === 0;
  }

  public get isLast(): boolean {
    return this.index === this.group.tabs.length - 1;
  }

  public get isPreview(): boolean {
    return this.tab.equals(this.group.preview);
  }
}
