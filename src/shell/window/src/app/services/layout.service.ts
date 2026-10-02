/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, Injectable, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { JsonException } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources";
import type { DockSide } from "../enums/dock-side";
import type { ILayoutStore } from "../interfaces/i-layout-store";
import type { DropTarget } from "../models/layout/drop-target";
import { Layout } from "../models/layout/layout";
import { LayoutGeometry } from "../models/layout/layout-geometry";
import { LayoutReader } from "../models/layout/layout.reader";
import type { SplitHandle } from "../models/layout/split-handle";
import type { Tab } from "../models/layout/tab";
import { ViewRegistry } from "../models/layout/view-registry";
import { LayoutStoreService } from "./layout-store.service";

@Injectable({ providedIn: "root" })
export class LayoutService {
  private readonly store: ILayoutStore = inject(LayoutStoreService);
  private readonly registryState: WritableSignal<ViewRegistry> = signal(ViewRegistry.createEmpty());
  private readonly layoutState: WritableSignal<Layout> = signal(Layout.createDefault(this.registryState()));
  private readonly width: WritableSignal<number> = signal(0);
  private readonly height: WritableSignal<number> = signal(0);
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  public readonly layout: Signal<Layout> = this.layoutState.asReadonly();
  public readonly registry: Signal<ViewRegistry> = this.registryState.asReadonly();
  public readonly geometry: Signal<LayoutGeometry> = computed(() => new LayoutGeometry(this.width(), this.height(), this.layoutState(), this.registryState()));

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.clearSaveTimer());
  }

  public setRegistry(registry: ViewRegistry): void {
    this.registryState.set(registry);
  }

  public setViewport(width: number, height: number): void {
    this.width.set(width);
    this.height.set(height);
  }

  public async loadAsync(): Promise<void> {
    const saved = await this.store.readAsync();
    this.clearSaveTimer();
    this.layoutState.set(Object.isNull(saved) ? Layout.createDefault(this.registryState()) : this.read(saved));
  }

  public async saveAsync(): Promise<void> {
    this.clearSaveTimer();
    await this.store.writeAsync(this.layoutState().toJson());
  }

  public place(tab: Tab, target: DropTarget): void {
    this.update(target.place(this.layoutState(), tab));
  }

  public activate(tab: Tab): void {
    this.update(this.layoutState().activate(tab));
  }

  public close(tab: Tab): void {
    this.update(this.layoutState().close(tab));
  }

  public toggleDock(side: DockSide): void {
    this.update(this.layoutState().toggleDock(side));
  }

  public resizeDock(side: DockSide, size: number | null): void {
    this.update(this.layoutState().resizeDock(side, size));
  }

  public resizeSplit(handle: SplitHandle, leadingLength: number): void {
    this.update(this.layoutState().resizeSplit(handle.resize(leadingLength)));
  }

  public reset(): void {
    this.update(this.layoutState().reset(this.registryState()));
  }

  private read(saved: unknown): Layout {
    try {
      return LayoutReader.read(saved);
    }
    catch (error) {
      if (!(error instanceof JsonException))
        throw error;
      return Layout.createDefault(this.registryState());
    }
  }

  private update(layout: Layout): void {
    if (layout === this.layoutState())
      return;
    this.layoutState.set(layout);
    this.clearSaveTimer();
    this.saveTimer = setTimeout(() => void this.saveAsync(), Resources.layoutSaveDelay);
  }

  private clearSaveTimer(): void {
    if (!Object.isNull(this.saveTimer))
      clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }
}
