/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgComponentOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, Injector, type InputSignal, type ResourceRef, type Signal, computed, inject, input, resource } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { DocumentTab } from "../../models/layout/document-tab";
import type { Tab } from "../../models/layout/tab";
import { TabContent } from "../../models/tab-content";
import { WindowPartTokens } from "../../models/window-part-tokens";
import { TabLabelService } from "../../services/tab-label.service";
import { WindowPartHostService } from "../../services/window-part-host.service";
import { ModuleFailureCardComponent } from "../module-failure-card/module-failure-card.component";

@Component({
  selector: "tr-tab-content",
  imports: [NgComponentOutlet],
  templateUrl: "./tab-content.component.html",
  styleUrl: "./tab-content.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-scroll-reveal"
  }
})
export class TabContentComponent {
  private readonly host: WindowPartHostService = inject(WindowPartHostService);
  private readonly labels: TabLabelService = inject(TabLabelService);
  private readonly injector: Injector = inject(Injector);

  public readonly tab: InputSignal<Tab> = input.required<Tab>();

  protected readonly content: ResourceRef<TabContent | null | undefined> = resource({
    params: () => ({ tab: this.tab(), generation: this.host.generation() }),
    loader: ({ params }) => this.loadAsync(params.tab)
  });

  public readonly isLoaded: Signal<boolean> = computed(() => this.content.hasValue());

  private async loadAsync(tab: Tab): Promise<TabContent | null> {
    const match = this.host.findContribution(tab);
    if (Object.isNull(match)) {
      const failure = this.host.findFailure(tab);
      return Object.isNull(failure) ? null : new TabContent(ModuleFailureCardComponent, this.injector, { failure });
    }

    const component = await match.loadComponent();
    if (Object.isNull(match.context))
      return new TabContent(component, this.injector, {});
    const injector = Injector.create({ providers: [{ provide: WindowPartTokens.context, useValue: match.context }], parent: this.injector });
    const inputs = tab instanceof DocumentTab ? { instance: tab.instance, title: this.labels.of(tab).title } : {};
    return new TabContent(component, injector, inputs);
  }
}
