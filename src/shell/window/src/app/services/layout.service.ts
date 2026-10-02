/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, ErrorHandler, Injectable, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { JsonException } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources";
import type { DockSide } from "../enums/dock-side";
import type { ILayoutStore } from "../interfaces/i-layout-store";
import type { DocumentTab } from "../models/layout/document-tab";
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
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly registryState: WritableSignal<ViewRegistry> = signal(ViewRegistry.createEmpty());
  private readonly layoutState: WritableSignal<Layout> = signal(Layout.createDefault(this.registryState()));
  private readonly width: WritableSignal<number> = signal(0);
  private readonly height: WritableSignal<number> = signal(0);
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saved: Layout | null = null;
  private writing: Promise<void> = Promise.resolve();

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
    const layout = Object.isNull(saved) ? Layout.createDefault(this.registryState()) : this.read(saved);
    this.clearSaveTimer();
    this.layoutState.set(layout);
    this.saved = layout;
  }

  public saveAsync(): Promise<void> {
    this.clearSaveTimer();
    const saving = this.writing.then(() => this.writeLatestAsync());
    this.writing = saving.catch(() => undefined);
    return saving;
  }

  public openDocument(tab: DocumentTab): void {
    this.update(this.layoutState().openDocument(tab));
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

  private async writeLatestAsync(): Promise<void> {
    const layout = this.layoutState();
    if (Object.isNull(this.saved) || layout === this.saved)
      return;
    await this.store.writeAsync(layout.toJson());
    this.saved = layout;
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
    if (!Object.isNull(this.saved))
      this.saveTimer = setTimeout(() => void this.saveAsync().catch((error: unknown) => this.errors.handleError(error)), Resources.layoutSaveDelay);
  }

  private clearSaveTimer(): void {
    if (!Object.isNull(this.saveTimer))
      clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }
}
