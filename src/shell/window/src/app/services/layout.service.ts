/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, ErrorHandler, Injectable, type Signal, type WritableSignal, computed, effect, inject, linkedSignal, signal, untracked } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { JsonException } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources";
import type { BottomDockSpan } from "../enums/bottom-dock-span";
import { DockSide } from "../enums/dock-side";
import { DockStyle } from "../enums/dock-style";
import { StartupStateKind } from "../enums/startup-state-kind";
import type { ILayoutStore } from "../interfaces/i-layout-store";
import { DockYield } from "../models/layout/dock-yield";
import type { DocumentTab } from "../models/layout/document-tab";
import type { DropTarget } from "../models/layout/drop-target";
import { Layout } from "../models/layout/layout";
import { LayoutGeometry } from "../models/layout/layout-geometry";
import { LayoutReader } from "../models/layout/layout.reader";
import type { ToolbarLayout } from "../models/layout/toolbar-layout";
import type { SplitHandle } from "../models/layout/split-handle";
import type { Tab } from "../models/layout/tab";
import type { TabGroup } from "../models/layout/tab-group";
import { TabReveal } from "../models/layout/tab-reveal";
import { ViewRegistry } from "../models/layout/view-registry";
import { LayoutStoreService } from "./layout-store.service";
import { SettingsService } from "./settings.service";
import { StartupService } from "./startup.service";

@Injectable({ providedIn: "root" })
export class LayoutService {
  private readonly store: ILayoutStore = inject(LayoutStoreService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly startup: StartupService = inject(StartupService);
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly registryState: WritableSignal<ViewRegistry> = signal(ViewRegistry.createEmpty());
  private readonly layoutState: WritableSignal<Layout> = signal(Layout.createDefault(this.registryState()));
  private readonly width: WritableSignal<number> = signal(0);
  private readonly height: WritableSignal<number> = signal(0);
  private readonly currentGroupId: WritableSignal<number | null> = signal(null);
  private readonly revealedState: WritableSignal<TabReveal | null> = signal(null);
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saved: Layout | null = null;
  private writing: Promise<void> = Promise.resolve();

  public readonly layout: Signal<Layout> = this.layoutState.asReadonly();
  public readonly revealed: Signal<TabReveal | null> = this.revealedState.asReadonly();
  public readonly registry: Signal<ViewRegistry> = this.registryState.asReadonly();
  public readonly iconSides: Signal<ReadonlySet<DockSide>> = computed(() =>
    new Set([...Resources.dockStyleSettings].filter(([, name]) => this.settings.values().get(name) === DockStyle.Icons).map(([side]) => side)));
  public readonly previewTabs: Signal<boolean> = computed(() => this.settings.values().get(Resources.previewTabsSetting) !== false);
  private readonly kept: WritableSignal<DockSide | null> = signal(null);
  public readonly geometry: Signal<LayoutGeometry> = linkedSignal({
    source: () => ({ width: this.width(), height: this.height(), layout: this.layoutState(), registry: this.registryState(), iconSides: this.iconSides(), kept: this.kept() }),
    computation: (source, previous?: { readonly value: LayoutGeometry }) => new LayoutGeometry(source.width, source.height, source.layout, source.registry, source.iconSides,
      new DockYield(source.layout.middleSize ?? Resources.middlePreferredSize, previous?.value.closedSides ?? new Set(), source.kept))
  });
  public readonly currentGroup: Signal<TabGroup> = computed(() => {
    const id = this.currentGroupId();
    return (Object.isNull(id) ? null : this.layoutState().group(id)) ?? this.layoutState().documents;
  });

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.clearSaveTimer());
    effect(() => {
      if (this.startup.state().kind === StartupStateKind.Ready)
        this.startSave();
    });
    effect(() => {
      if (!this.previewTabs())
        this.update(this.layoutState().keepPreviews());
    });
  }

  public setRegistry(registry: ViewRegistry): void {
    this.registryState.set(registry);
  }

  public setViewport(width: number, height: number): void {
    this.width.set(width);
    this.height.set(height);
    if (!untracked(() => this.geometry().isKeeping))
      this.kept.set(null);
  }

  public async loadAsync(): Promise<boolean> {
    const saved = await this.store.readAsync();
    const read = Object.isNull(saved) ? null : this.read(saved);
    const layout = read ?? Layout.createDefault(this.registryState());
    this.clearSaveTimer();
    this.layoutState.set(layout);
    this.saved = layout;
    return !Object.isNull(read);
  }

  public saveAsync(): Promise<void> {
    this.clearSaveTimer();
    const saving = this.writing.then(() => this.writeLatestAsync());
    this.writing = saving.catch(() => undefined);
    return saving;
  }

  public openDocument(tab: DocumentTab, isPreview: boolean = false): void {
    this.update(this.layoutState().openDocument(tab, isPreview && this.previewTabs()));
    this.reveal(tab);
  }

  public restoreDocument(tab: DocumentTab, isPreview: boolean): void {
    this.update(this.layoutState().restoreDocument(tab, isPreview && this.previewTabs()));
  }

  public keep(tab: Tab): void {
    this.update(this.layoutState().keep(tab));
  }

  public place(tab: Tab, target: DropTarget): void {
    this.update(target.place(this.layoutState(), tab));
  }

  public activate(tab: Tab): void {
    this.update(this.layoutState().activate(tab));
    this.reveal(tab);
    const group = this.layoutState().groupOf(tab);
    if (!Object.isNull(group))
      this.focusGroup(group.id);
  }

  public focusGroup(id: number): void {
    this.currentGroupId.set(id);
    this.update(this.layoutState().focusDocuments(id));
  }

  public close(tab: Tab): void {
    this.update(this.layoutState().close(tab));
  }

  public closeTabs(tabs: readonly Tab[]): void {
    this.update(tabs.reduce((layout, t) => layout.close(t), this.layoutState()));
  }

  public toggleDock(side: DockSide): void {
    if (this.geometry().closedSides.has(side)) {
      this.kept.set(side);
      return;
    }
    this.update(this.layoutState().toggleDock(side));
    if (this.kept() === side)
      this.kept.set(null);
  }

  public keepOpen(side: DockSide): void {
    if (this.geometry().closedSides.has(side))
      this.kept.set(side);
  }

  public resizeDock(side: DockSide, size: number): void {
    const layout = this.layoutState().resizeDock(side, size);
    if (side === DockSide.Bottom) {
      this.update(layout);
      return;
    }
    const geometry = this.geometry();
    const other = side === DockSide.Left ? DockSide.Right : DockSide.Left;
    const shown = geometry.dock(other).width;
    const held = geometry.isCollapsed(other) || layout.dock(other).preferredTrack <= shown + Resources.panelGap ? layout : layout.resizeDock(other, shown);
    this.update(held.withMiddleSize(this.middleAfter(side, size)));
  }

  public setBottomSpan(span: BottomDockSpan): void {
    this.update(this.layoutState().withBottomSpan(span));
  }

  public resizeSplit(handle: SplitHandle, leadingLength: number): void {
    this.update(this.layoutState().resizeSplit(handle.resize(leadingLength)));
  }

  public setToolbars(toolbars: ToolbarLayout): void {
    this.update(this.layoutState().withToolbars(toolbars));
  }

  public reset(): void {
    this.update(this.layoutState().reset(this.registryState()));
  }

  private middleAfter(side: DockSide, size: number): number | null {
    const geometry = this.geometry();
    const middle = geometry.middle.width + geometry.dock(side).width - size;
    return middle < Resources.middlePreferredSize ? Math.max(0, middle) : null;
  }

  private reveal(tab: Tab): void {
    this.revealedState.set(new TabReveal(tab, (this.revealedState()?.sequence ?? 0) + 1));
  }

  private async writeLatestAsync(): Promise<void> {
    const layout = this.layoutState();
    if (Object.isNull(this.saved) || layout === this.saved || this.startup.state().kind !== StartupStateKind.Ready)
      return;
    if (await this.store.writeAsync(layout.toJson()))
      this.saved = layout;
  }

  private read(saved: unknown): Layout | null {
    try {
      return LayoutReader.read(saved);
    }
    catch (error) {
      if (!(error instanceof JsonException))
        throw error;
      return null;
    }
  }

  private update(layout: Layout): void {
    if (layout === this.layoutState())
      return;
    this.layoutState.set(layout);
    this.clearSaveTimer();
    if (!Object.isNull(this.saved))
      this.saveTimer = setTimeout(() => this.startSave(), Resources.layoutSaveDelay);
  }

  private startSave(): void {
    void this.saveAsync().catch((error: unknown) => this.errors.handleError(error));
  }

  private clearSaveTimer(): void {
    if (!Object.isNull(this.saveTimer))
      clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }
}
