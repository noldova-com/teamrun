/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApplicationRef, DestroyRef, EnvironmentInjector, Injectable, type Signal, type WritableSignal, afterNextRender, createComponent, effect, inject, signal,
  untracked } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { TabContentComponent } from "../components/tab-content/tab-content.component";
import type { Tab } from "../models/layout/tab";
import { LiveView } from "../models/live-view";
import { LayoutService } from "./layout.service";
import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class LiveViewService {
  private readonly application: ApplicationRef = inject(ApplicationRef);
  private readonly environment: EnvironmentInjector = inject(EnvironmentInjector);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly views: Map<string, LiveView> = new Map();
  private readonly destroyedValue: WritableSignal<number> = signal(0);

  public readonly destroyed: Signal<number> = this.destroyedValue.asReadonly();

  public constructor() {
    effect(() => {
      const layout = this.layout.layout();
      untracked(() => this.removeWhere(t => Object.isNull(t.slot) && !layout.isOpen(t.tab)));
    });
    inject(DestroyRef).onDestroy(() => this.removeWhere(() => true));
  }

  public show(tab: Tab, slot: HTMLElement, isDocked: boolean): TabContentComponent {
    const view = this.views.get(tab.key) ?? this.create(tab);
    view.ref.setInput(Resources.tabInput, tab);
    view.ref.setInput(Resources.dockedInput, isDocked);
    if (view.slot === slot)
      return view.ref.instance;
    if (Object.isNull(view.slot))
      this.application.attachView(view.ref.hostView);
    else
      view.leave();
    view.ref.setInput(Resources.shownInput, true);
    view.enter(slot);
    view.ref.changeDetectorRef.markForCheck();
    afterNextRender(() => view.restore(), { injector: this.environment });
    return view.ref.instance;
  }

  public hide(tab: Tab, slot: HTMLElement): void {
    const view = this.views.get(tab.key);
    if (Object.isUndefined(view) || view.slot !== slot)
      return;
    view.leave();
    view.ref.setInput(Resources.shownInput, false);
    this.application.detachView(view.ref.hostView);
    if (!this.layout.layout().isOpen(tab))
      this.remove(view);
  }

  public destroy(owns: (tab: Tab) => boolean): void {
    this.removeWhere(t => owns(t.tab));
  }

  private removeWhere(test: (view: LiveView) => boolean): void {
    const doomed = [...this.views.values()].filter(test);
    for (const view of doomed)
      this.remove(view);
    if (doomed.length > 0)
      this.destroyedValue.update(t => t + 1);
  }

  private create(tab: Tab): LiveView {
    const view = new LiveView(tab, createComponent(TabContentComponent, { environmentInjector: this.environment }));
    this.views.set(tab.key, view);
    return view;
  }

  private remove(view: LiveView): void {
    this.views.delete(view.tab.key);
    view.element.remove();
    view.ref.destroy();
  }
}
