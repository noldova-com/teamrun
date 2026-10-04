/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Tab } from "./tab";
import type { TabDropTarget } from "./tab-drop-target";
import type { TabGroup } from "./tab-group";

export class DockStripIcon {
  public readonly group: TabGroup;
  public readonly tab: Tab;
  public readonly before: TabDropTarget;
  public readonly after: TabDropTarget;

  public constructor(group: TabGroup, tab: Tab, before: TabDropTarget, after: TabDropTarget) {
    this.group = group;
    this.tab = tab;
    this.before = before;
    this.after = after;
  }
}
