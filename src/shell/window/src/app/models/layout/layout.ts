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
import { DockSide } from "../../enums/dock-side";
import type { PanelEdge } from "../../enums/panel-edge";
import { Dock } from "./dock";
import { DocumentGroup } from "./document-group";
import type { DocumentTab } from "./document-tab";
import type { LayoutNode } from "./layout.node";
import { SplitNode } from "./split.node";
import type { Tab } from "./tab";
import { TabGroup } from "./tab-group";
import type { ViewRegistry } from "./view-registry";
import { ViewTab } from "./view-tab";

export class Layout {
  private readonly dockSides: Readonly<Record<DockSide, Dock>>;
  public readonly middle: LayoutNode;
  public readonly documents: TabGroup;

  public constructor(docks: readonly Dock[], middle: LayoutNode | null) {
    const documents = middle?.groups.filter(t => t.isDocuments) ?? [];
    const [document] = documents;
    if (Object.isNull(middle) || Object.isUndefined(document) || documents.length !== 1)
      throw new ArgumentException(Resources.missingDocumentsGroup, "middle");
    const docked = docks.flatMap(t => t.root?.groups ?? []);
    const tabs = [...docked, ...middle.groups].flatMap(t => t.tabs);
    const ids = [...docks.flatMap(t => t.root?.nodeIds ?? []), ...middle.nodeIds];
    if (docked.some(t => t.isDocuments))
      throw new ArgumentException(Resources.documentsInDock, "docks");
    if (new Set(docks.map(t => t.side)).size !== docks.length)
      throw new ArgumentException(Resources.repeatedDock, "docks");
    if (new Set(tabs.map(t => t.key)).size !== tabs.length)
      throw new ArgumentException(Resources.repeatedTab);
    if (new Set(ids).size !== ids.length)
      throw new ArgumentException(Resources.repeatedNodeId);

    this.dockSides = {
      [DockSide.Left]: Layout.dockOn(DockSide.Left, docks),
      [DockSide.Right]: Layout.dockOn(DockSide.Right, docks),
      [DockSide.Bottom]: Layout.dockOn(DockSide.Bottom, docks)
    };
    this.middle = middle;
    this.documents = document;
  }

  public static createDefault(registry: ViewRegistry): Layout {
    let id = Resources.documentsGroupId;
    const docks = Object.values(DockSide).map(side => {
      const tabs = registry.views.filter(t => t.isShownByDefault && t.defaultSide === side).map(t => new ViewTab(t.name));
      const [first] = tabs;
      return new Dock(side, Object.isUndefined(first) ? null : new TabGroup(++id, tabs, first), null, false);
    });
    return new Layout(docks, DocumentGroup.createEmpty());
  }

  public get docks(): readonly Dock[] {
    return Object.values(DockSide).map(t => this.dockSides[t]);
  }

  public get groups(): readonly TabGroup[] {
    return [...this.docks.flatMap(t => t.root?.groups ?? []), ...this.middle.groups];
  }

  public dock(side: DockSide): Dock {
    return this.dockSides[side];
  }

  public group(id: number): TabGroup | null {
    return this.groups.find(t => t.id === id) ?? null;
  }

  public groupOf(tab: Tab): TabGroup | null {
    return this.groups.find(t => t.has(tab)) ?? null;
  }

  public sideOf(groupId: number): DockSide | null {
    return this.docks.find(t => t.holds(groupId))?.side ?? null;
  }

  public isOpen(tab: Tab): boolean {
    return !Object.isNull(this.groupOf(tab));
  }

  public openView(tab: ViewTab, registry: ViewRegistry): Layout {
    if (this.isOpen(tab))
      return this.activate(tab);
    const dock = this.dock(registry.view(tab.name).defaultSide);
    const root = dock.root;
    const opened = Object.isNull(root) ? new TabGroup(this.nextId, [tab], tab) : root.withGroup(root.cornerGroup.insert(tab, root.cornerGroup.tabs.length));
    return this.withDock(dock.withRoot(opened).withCollapsed(false));
  }

  public openDocument(tab: DocumentTab): Layout {
    if (this.isOpen(tab))
      return this.activate(tab);
    return this.withGroup(this.documents.insert(tab, this.documents.tabs.length));
  }

  public close(tab: Tab): Layout {
    const group = this.groupOf(tab);
    if (Object.isNull(group))
      return this;
    const rest = group.without(tab);
    return Object.isNull(rest) ? this.withoutGroup(group.id) : this.withGroup(rest);
  }

  public activate(tab: Tab): Layout {
    const group = this.groupOf(tab);
    return Object.isNull(group) ? this : this.withGroup(group.activate(tab)).reveal(group.id);
  }

  public moveTab(tab: Tab, groupId: number, index: number): Layout {
    const target = this.group(groupId);
    if (Object.isNull(target) || !target.accepts(tab))
      return this;
    const layout = target.has(tab) ? this : this.close(tab);
    return layout.withGroup(target.insert(tab, index)).reveal(groupId);
  }

  public splitGroup(tab: Tab, groupId: number, edge: PanelEdge): Layout {
    const target = this.group(groupId);
    if (Object.isNull(target) || !tab.isMovable || (target.has(tab) && target.tabs.length === 1 && !target.isDocuments))
      return this;
    const layout = this.close(tab);
    const added = new TabGroup(layout.nextId, [tab], tab);
    return layout.withRegions(t => t.splitGroup(groupId, added, edge, added.id + 1)).reveal(added.id);
  }

  public dockOnSide(tab: Tab, side: DockSide): Layout {
    if (!tab.isMovable)
      return this;
    const source = this.groupOf(tab);
    if (!Object.isNull(source) && this.dock(side).root === source && source.tabs.length === 1)
      return this.withDock(this.dock(side).withCollapsed(false));
    const layout = this.close(tab);
    const dock = layout.dock(side);
    const added = new TabGroup(layout.nextId, [tab], tab);
    const root = Object.isNull(dock.root) ? added : SplitNode.beside(dock.root, added, Resources.dockEdges[side], added.id + 1);
    return layout.withDock(dock.withRoot(root).withCollapsed(false));
  }

  public toggleDock(side: DockSide): Layout {
    return this.withDock(this.dock(side).withCollapsed(!this.dock(side).isCollapsed));
  }

  public resizeDock(side: DockSide, size: number | null): Layout {
    return this.withDock(this.dock(side).withSize(size));
  }

  public resizeSplit(split: SplitNode): Layout {
    return this.withRegions(t => t.withSplit(split));
  }

  public reset(registry: ViewRegistry): Layout {
    const fresh = Layout.createDefault(registry);
    const documents = this.documents.tabs.filter(t => !t.isMovable);
    const active = documents.find(t => t.equals(this.documents.active)) ?? documents[0] ?? null;
    const views = this.groups.flatMap(t => t.tabs).filter(t => t instanceof ViewTab && registry.hasView(t.name) && !fresh.isOpen(t));
    return views.reduce((layout, t) => layout.openView(t, registry), fresh.withGroup(new DocumentGroup(documents, active)));
  }

  public withVisibleTabs(registry: ViewRegistry): Layout {
    return this.copy(this.docks.map(t => t.withVisibleTabs(registry)), this.middle.withVisibleTabs(registry));
  }

  public toJson(): JsonObject {
    return {
      [Resources.versionField]: Resources.layoutFormatVersion,
      [Resources.docksField]: Object.fromEntries(this.docks.map(t => [t.side, t.toJson()])),
      [Resources.middleField]: this.middle.toJson()
    };
  }

  private static dockOn(side: DockSide, docks: readonly Dock[]): Dock {
    return docks.find(t => t.side === side) ?? Dock.createEmpty(side);
  }

  private get nextId(): number {
    return Math.max(...this.docks.flatMap(t => t.root?.nodeIds ?? []), ...this.middle.nodeIds) + 1;
  }

  private withGroup(group: TabGroup): Layout {
    return this.withRegions(t => t.withGroup(group));
  }

  private withoutGroup(id: number): Layout {
    return this.copy(this.docks.map(t => t.withRoot(t.root?.withoutGroup(id) ?? null)), this.middle.withoutGroup(id));
  }

  private withRegions(change: (node: LayoutNode) => LayoutNode): Layout {
    return this.copy(this.docks.map(t => Object.isNull(t.root) ? t : t.withRoot(change(t.root))), change(this.middle));
  }

  private withDock(dock: Dock): Layout {
    return this.copy(this.docks.map(t => t.side === dock.side ? dock : t), this.middle);
  }

  private reveal(groupId: number): Layout {
    const side = this.sideOf(groupId);
    return Object.isNull(side) ? this : this.withDock(this.dock(side).withCollapsed(false));
  }

  private copy(docks: readonly Dock[], middle: LayoutNode | null): Layout {
    return middle === this.middle && docks.every(t => t === this.dock(t.side)) ? this : new Layout(docks, middle);
  }
}
