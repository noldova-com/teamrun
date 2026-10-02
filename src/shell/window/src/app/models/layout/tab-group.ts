/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../../resources";
import type { DockSide } from "../../enums/dock-side";
import type { PanelEdge } from "../../enums/panel-edge";
import type { SplitAxis } from "../../enums/split-axis";
import type { Bounds } from "./bounds";
import { GroupFrame } from "./group-frame";
import { LayoutNode } from "./layout.node";
import { SplitNode } from "./split.node";
import type { Tab } from "./tab";
import type { ViewRegistry } from "./view-registry";

export class TabGroup extends LayoutNode {
  public readonly tabs: readonly Tab[];
  public readonly active: Tab | null;

  public constructor(id: number, tabs: readonly Tab[], active: Tab | null) {
    super(id);
    if (new Set(tabs.map(t => t.key)).size !== tabs.length)
      throw new ArgumentException(Resources.repeatedTab, "tabs");
    if (!tabs.every(t => this.accepts(t)))
      throw new ArgumentException(Resources.documentOutsideDocuments, "tabs");
    if (tabs.length === 0 && !this.isDocuments)
      throw new ArgumentException(Resources.emptyViewGroup, "tabs");
    const current = tabs.find(t => t.equals(active));
    if (Object.isUndefined(current) !== (tabs.length === 0))
      throw new ArgumentException(Resources.inactiveTab, "active");

    this.tabs = [...tabs];
    this.active = current ?? null;
  }

  public get isDocuments(): boolean {
    return false;
  }

  public override get groups(): readonly TabGroup[] {
    return [this];
  }

  public override get nodeIds(): readonly number[] {
    return [this.id];
  }

  public override get cornerGroup(): TabGroup {
    return this;
  }

  public accepts(tab: Tab): boolean {
    return tab.isMovable;
  }

  public has(tab: Tab): boolean {
    return this.tabs.some(t => t.equals(tab));
  }

  public insert(tab: Tab, index: number): TabGroup {
    if (!this.accepts(tab))
      throw new ArgumentException(Resources.documentOutsideDocuments, "tab");
    const current = this.tabs.findIndex(t => t.equals(tab));
    const others = this.tabs.filter(t => !t.equals(tab));
    const at = Math.max(0, Math.min(others.length, current >= 0 && current < index ? index - 1 : index));
    if (at === current && tab.equals(this.active))
      return this;
    return this.copy([...others.slice(0, at), tab, ...others.slice(at)], tab);
  }

  public without(tab: Tab): TabGroup | null {
    const index = this.tabs.findIndex(t => t.equals(tab));
    if (index < 0)
      return this;
    const rest = this.tabs.filter(t => !t.equals(tab));
    const next = rest[Math.min(index, rest.length - 1)];
    if (Object.isUndefined(next))
      return this.emptied();
    return this.copy(rest, tab.equals(this.active) ? next : this.active);
  }

  public activate(tab: Tab): TabGroup {
    return this.has(tab) && !tab.equals(this.active) ? this.copy(this.tabs, tab) : this;
  }

  public override minimumLength(axis: SplitAxis): number {
    return Resources.groupMinimumLengths[axis];
  }

  public override withGroup(group: TabGroup): LayoutNode {
    return group.id === this.id ? group : this;
  }

  public override withoutGroup(id: number): LayoutNode | null {
    return id === this.id ? null : this;
  }

  public override splitGroup(id: number, added: TabGroup, edge: PanelEdge, splitId: number): LayoutNode {
    return id === this.id ? SplitNode.beside(this, added, edge, splitId) : this;
  }

  public override withSplit(): LayoutNode {
    return this;
  }

  public override withVisibleTabs(registry: ViewRegistry): TabGroup | null {
    const available = this.tabs.filter(t => t.isAvailable(registry));
    const [first] = available;
    if (available.length === this.tabs.length)
      return this;
    if (Object.isUndefined(first))
      return this.emptied();
    return this.copy(available, available.find(t => t.equals(this.active)) ?? first);
  }

  public override arrange(bounds: Bounds, side: DockSide | null, frames: GroupFrame[]): void {
    frames.push(new GroupFrame(this, bounds, side));
  }

  public override toJson(): JsonObject {
    const active = this.tabs.findIndex(t => t.equals(this.active));
    return { [Resources.tabsField]: this.tabs.map(t => t.toJson()), [Resources.activeField]: active < 0 ? null : active };
  }

  protected copy(tabs: readonly Tab[], active: Tab | null): TabGroup {
    return new TabGroup(this.id, tabs, active);
  }

  protected emptied(): TabGroup | null {
    return null;
  }
}
