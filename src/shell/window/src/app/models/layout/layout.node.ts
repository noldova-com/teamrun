/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonObject } from "@noldova/teamrun-foundation-json";

import type { DockSide } from "../../enums/dock-side";
import type { PanelEdge } from "../../enums/panel-edge";
import type { SplitAxis } from "../../enums/split-axis";
import type { Bounds } from "./bounds";
import type { GroupFrame } from "./group-frame";
import type { SplitHandle } from "./split-handle";
import type { SplitNode } from "./split.node";
import type { TabGroup } from "./tab-group";
import type { ViewRegistry } from "./view-registry";

export abstract class LayoutNode {
  public readonly id: number;

  protected constructor(id: number) {
    if (!Number.isInteger(id) || id < 0)
      throw new ArgumentOutOfRangeException("id", id);

    this.id = id;
  }

  public abstract get groups(): readonly TabGroup[];

  public abstract get nodeIds(): readonly number[];

  public abstract get cornerGroup(): TabGroup;

  public abstract minimumLength(axis: SplitAxis): number;

  public abstract withGroup(group: TabGroup): LayoutNode;

  public abstract withoutGroup(id: number): LayoutNode | null;

  public abstract splitGroup(id: number, added: TabGroup, edge: PanelEdge, splitId: number): LayoutNode;

  public abstract withSplit(split: SplitNode): LayoutNode;

  public abstract withVisibleTabs(registry: ViewRegistry): LayoutNode | null;

  public abstract arrange(bounds: Bounds, side: DockSide | null, frames: GroupFrame[], handles: SplitHandle[]): void;

  public abstract toJson(): JsonObject;
}
