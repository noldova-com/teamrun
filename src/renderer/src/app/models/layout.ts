/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { DockSide } from "../enums/dock-side";
import { PanelId } from "../enums/panel-id";
import { Resources } from "../resources";
import { Dock } from "./dock";
import { DocumentTabs } from "./document-tabs";

export class Layout {
  public readonly docks: ReadonlyMap<DockSide, Dock>;
  public readonly documents: DocumentTabs;
  public readonly collapsedProjects: readonly string[];
  public readonly pinnedConversations: readonly string[];
  public readonly projectOrder: readonly string[];
  public readonly conversationOrder: ReadonlyMap<string, readonly string[]>;

  public constructor(docks: readonly Dock[], documents: DocumentTabs, collapsedProjects: readonly string[] = [],
    pinnedConversations: readonly string[] = [], projectOrder: readonly string[] = [],
    conversationOrder: ReadonlyMap<string, readonly string[]> = new Map()) {
    const map = new Map<DockSide, Dock>();
    const seen = new Set<PanelId>();
    for (const side of Object.values(DockSide)) {
      const given = docks.find(t => t.side === side) ?? Dock.createEmpty(side);
      const panels = given.panels.filter(t => !seen.has(t));
      for (const panel of panels)
        seen.add(panel);
      map.set(side, new Dock(side, panels, given.activePanel, given.size, given.collapsed));
    }
    this.docks = map;
    this.documents = documents;
    this.collapsedProjects = Layout.distinct(collapsedProjects);
    this.pinnedConversations = Layout.distinct(pinnedConversations);
    this.projectOrder = Layout.distinct(projectOrder);
    const orders = [...conversationOrder].filter(([projectId]) => !String.isNullOrWhitespace(projectId));
    this.conversationOrder = new Map(orders.map(([projectId, ids]) => [projectId, Layout.distinct(ids)]));
  }

  public static createDefault(): Layout {
    return Layout.createWith(DocumentTabs.createEmpty());
  }

  public resetDocks(): Layout {
    return Layout.createWith(this.documents, this.collapsedProjects, this.pinnedConversations, this.projectOrder, this.conversationOrder);
  }

  private static createWith(documents: DocumentTabs, collapsedProjects: readonly string[] = [], pinnedConversations: readonly string[] = [],
    projectOrder: readonly string[] = [], conversationOrder: ReadonlyMap<string, readonly string[]> = new Map()): Layout {
    const docks = Object.values(DockSide).map(side => {
      const panels = Object.values(PanelId).filter(t => Resources.defaultDockSides[t] === side);
      return new Dock(side, panels, null, null, Resources.defaultCollapsedDocks.includes(side));
    });
    return new Layout(docks, documents, collapsedProjects, pinnedConversations, projectOrder, conversationOrder);
  }

  public static fromJson(value: unknown): Layout {
    if (!Object.isObject(value) || Array.isArray(value))
      return Layout.createDefault();
    const record: Record<string, unknown> = { ...value };
    const docksValue = record[Resources.docksField];
    const docks: Record<string, unknown> = Object.isObject(docksValue) && !Array.isArray(docksValue) ? { ...docksValue } : {};

    const collapsed = Layout.readIds(record[Resources.collapsedProjectsField]);
    const pinned = Layout.readIds(record[Resources.pinnedConversationsField]);
    const order = Layout.readIds(record[Resources.projectOrderField]);
    const conversationOrder = Layout.readOrders(record[Resources.conversationOrderField]);

    return new Layout(Object.values(DockSide).map(side => Dock.fromJson(side, docks[side])), DocumentTabs.fromJson(record[Resources.documentsField]), collapsed,
      pinned, order, conversationOrder);
  }

  private static readOrders(value: unknown): ReadonlyMap<string, readonly string[]> {
    if (!Object.isObject(value) || Array.isArray(value))
      return new Map();
    return new Map(Object.entries({ ...value }).map(([projectId, ids]) => [projectId, Layout.readIds(ids)]));
  }

  private static readIds(value: unknown): readonly string[] {
    return Array.isArray(value) ? value.filter(t => Object.isString(t)) : [];
  }

  private static distinct(ids: readonly string[]): readonly string[] {
    return [...new Set(ids.filter(t => !String.isNullOrWhitespace(t)))];
  }

  public toJson(): Record<string, unknown> {
    const docks: Record<string, unknown> = {};
    for (const [side, dock] of this.docks)
      docks[side] = dock.toJson();
    return {
      [Resources.docksField]: docks, [Resources.documentsField]: this.documents.toJson(), [Resources.collapsedProjectsField]: this.collapsedProjects,
      [Resources.pinnedConversationsField]: this.pinnedConversations, [Resources.projectOrderField]: this.projectOrder,
      [Resources.conversationOrderField]: Object.fromEntries([...this.conversationOrder].map(([projectId, ids]) => [projectId, [...ids]]))
    };
  }

  public dock(side: DockSide): Dock {
    const dock = this.docks.get(side);
    if (Object.isUndefined(dock))
      throw new RangeError(side);
    return dock;
  }

  public dockOf(panel: PanelId): Dock | null {
    for (const dock of this.docks.values())
      if (dock.has(panel))
        return dock;
    return null;
  }

  public isOpen(panel: PanelId): boolean {
    return !Object.isNull(this.dockOf(panel));
  }

  public openPanel(panel: PanelId): Layout {
    const dock = this.dockOf(panel) ?? this.dock(Resources.defaultDockSides[panel]);
    return this.withDock(dock.add(panel).withCollapsed(false));
  }

  public closePanel(panel: PanelId): Layout {
    const dock = this.dockOf(panel);
    return Object.isNull(dock) ? this : this.withDock(dock.remove(panel));
  }

  public movePanel(panel: PanelId, side: DockSide, index: number = Number.MAX_SAFE_INTEGER): Layout {
    const from = this.dockOf(panel);
    const without = Object.isNull(from) ? this : this.withDock(from.remove(panel));
    return without.withDock(without.dock(side).add(panel, index).withCollapsed(false));
  }

  public togglePanel(panel: PanelId): Layout {
    const dock = this.dockOf(panel);
    const shown = !Object.isNull(dock) && !dock.collapsed && dock.activePanel === panel;
    return shown ? this.closePanel(panel) : this.openPanel(panel);
  }

  public activatePanel(panel: PanelId): Layout {
    const dock = this.dockOf(panel);
    return Object.isNull(dock) ? this : this.withDock(dock.activate(panel));
  }

  public toggleDock(side: DockSide): Layout {
    const dock = this.dock(side);
    return this.withDock(dock.withCollapsed(!dock.collapsed));
  }

  public resizeDock(side: DockSide, size: number | null): Layout {
    return this.withDock(this.dock(side).withSize(size));
  }

  public showDocument(conversationId: string, preview: boolean = false): Layout {
    return this.copy(this.documents.show(conversationId, preview));
  }

  public keepDocumentOpen(conversationId: string): Layout {
    const kept = this.documents.keepOpen(conversationId);
    return kept === this.documents ? this : this.copy(kept);
  }

  public closeDocument(conversationId: string): Layout {
    const closed = this.documents.close(conversationId);
    return closed === this.documents ? this : this.copy(closed);
  }

  public keepDocuments(existing: readonly string[]): Layout {
    const kept = this.documents.keep(existing);
    const pinned = this.pinnedConversations.filter(t => existing.includes(t));
    return kept === this.documents && pinned.length === this.pinnedConversations.length ? this : this.copy(kept, this.collapsedProjects, pinned);
  }

  public isPinned(conversationId: string): boolean {
    return this.pinnedConversations.includes(conversationId);
  }

  public togglePin(conversationId: string): Layout {
    const pinned = this.isPinned(conversationId) ? this.pinnedConversations.filter(t => t !== conversationId) : [...this.pinnedConversations, conversationId];
    return this.copy(this.documents, this.collapsedProjects, pinned);
  }

  public orderPins(order: readonly string[]): Layout {
    const pinned = [...order.filter(t => this.isPinned(t)), ...this.pinnedConversations.filter(t => !order.includes(t))];
    return this.copy(this.documents, this.collapsedProjects, pinned);
  }

  public orderProjects(order: readonly string[]): Layout {
    return this.copy(this.documents, this.collapsedProjects, this.pinnedConversations, order);
  }

  public conversationOrderOf(projectId: string): readonly string[] {
    return this.conversationOrder.get(projectId) ?? [];
  }

  public orderConversations(projectId: string, order: readonly string[]): Layout {
    return this.copy(this.documents, this.collapsedProjects, this.pinnedConversations, this.projectOrder, [...this.docks.values()],
      new Map(this.conversationOrder).set(projectId, order));
  }

  public isProjectCollapsed(projectId: string): boolean {
    return this.collapsedProjects.includes(projectId);
  }

  public toggleProject(projectId: string): Layout {
    const collapsed = this.isProjectCollapsed(projectId) ? this.collapsedProjects.filter(t => t !== projectId) : [...this.collapsedProjects, projectId];
    return this.copy(this.documents, collapsed);
  }

  private withDock(dock: Dock): Layout {
    const docks = [...this.docks.values()].map(t => (t.side === dock.side ? dock : t));
    return this.copy(this.documents, this.collapsedProjects, this.pinnedConversations, this.projectOrder, docks);
  }

  private copy(documents: DocumentTabs, collapsedProjects: readonly string[] = this.collapsedProjects,
    pinnedConversations: readonly string[] = this.pinnedConversations, projectOrder: readonly string[] = this.projectOrder,
    docks: readonly Dock[] = [...this.docks.values()], conversationOrder: ReadonlyMap<string, readonly string[]> = this.conversationOrder): Layout {
    return new Layout(docks, documents, collapsedProjects, pinnedConversations, projectOrder, conversationOrder);
  }
}
