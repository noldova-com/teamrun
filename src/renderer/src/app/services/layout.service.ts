/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { Injectable, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import type { DockSide } from "../enums/dock-side";
import type { PanelId } from "../enums/panel-id";
import type { Dock } from "../models/dock";
import { Layout } from "../models/layout";
import { Resources } from "../resources";

@Injectable({ providedIn: "root" })
export class LayoutService {
  private readonly document: Document = inject(DOCUMENT);
  private readonly current: WritableSignal<Layout> = signal(this.read());

  public readonly layout: Signal<Layout> = this.current.asReadonly();
  public readonly documents: Signal<readonly string[]> = computed(() => this.current().documents.open);
  public readonly activeDocument: Signal<string | null> = computed(() => this.current().documents.active);
  public readonly previewDocument: Signal<string | null> = computed(() => this.current().documents.preview);
  public readonly pinnedConversations: Signal<readonly string[]> = computed(() => this.current().pinnedConversations);
  public readonly projectOrder: Signal<readonly string[]> = computed(() => this.current().projectOrder);
  public readonly conversationOrder: Signal<ReadonlyMap<string, readonly string[]>> = computed(() => this.current().conversationOrder);

  public dock(side: DockSide): Dock {
    return this.current().dock(side);
  }

  public isOpen(panel: PanelId): boolean {
    return this.current().isOpen(panel);
  }

  public openPanel(panel: PanelId): void {
    this.update(t => t.openPanel(panel));
  }

  public closePanel(panel: PanelId): void {
    this.update(t => t.closePanel(panel));
  }

  public movePanel(panel: PanelId, side: DockSide, index?: number): void {
    this.update(t => t.movePanel(panel, side, index));
  }

  public togglePanel(panel: PanelId): void {
    this.update(t => t.togglePanel(panel));
  }

  public activatePanel(panel: PanelId): void {
    this.update(t => t.activatePanel(panel));
  }

  public toggleDock(side: DockSide): void {
    this.update(t => t.toggleDock(side));
  }

  public resizeDock(side: DockSide, size: number | null): void {
    this.update(t => t.resizeDock(side, size));
  }

  public toggleProject(projectId: string): void {
    this.update(t => t.toggleProject(projectId));
  }

  public togglePin(conversationId: string): void {
    this.update(t => t.togglePin(conversationId));
  }

  public orderPins(order: readonly string[]): void {
    this.update(t => t.orderPins(order));
  }

  public orderProjects(order: readonly string[]): void {
    this.update(t => t.orderProjects(order));
  }

  public orderConversations(projectId: string, order: readonly string[]): void {
    this.update(t => t.orderConversations(projectId, order));
  }

  public showDocument(conversationId: string, preview: boolean = false): void {
    this.update(t => t.showDocument(conversationId, preview));
  }

  public keepDocumentOpen(conversationId: string): void {
    this.update(t => t.keepDocumentOpen(conversationId));
  }

  public closeDocument(conversationId: string): void {
    this.update(t => t.closeDocument(conversationId));
  }

  public keepDocuments(existing: readonly string[]): void {
    this.update(t => t.keepDocuments(existing));
  }

  public reset(): void {
    this.update(layout => layout.resetDocks());
  }

  public flush(): boolean {
    try {
      const storage = this.document.defaultView?.localStorage;
      if (Object.isUndefined(storage))
        return false;
      storage.setItem(Resources.layoutStorageKey, JSON.stringify(this.current().toJson()));
      return true;
    }
    catch {
      return false;
    }
  }

  private update(change: (layout: Layout) => Layout): void {
    const next = change(this.current());
    if (next === this.current())
      return;
    this.current.set(next);
    this.write(next);
  }

  private read(): Layout {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(Resources.layoutStorageKey) ?? null;
      return Object.isNull(stored) ? Layout.createDefault() : Layout.fromJson(JSON.parse(stored));
    }
    catch {
      return Layout.createDefault();
    }
  }

  private write(layout: Layout): void {
    try {
      this.document.defaultView?.localStorage.setItem(Resources.layoutStorageKey, JSON.stringify(layout.toJson()));
    }
    catch {
    }
  }
}
