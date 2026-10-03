/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy, Component, EnvironmentInjector, type Signal, type TemplateRef, afterNextRender, computed, inject, input, viewChild
} from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective } from "@noldova/teamrun-shell-ui";

import { Resources } from "../../../resources";
import { DockSide } from "../../enums/dock-side";
import { PanelEdge } from "../../enums/panel-edge";
import type { DropTarget } from "../../models/layout/drop-target";
import { SideDropTarget } from "../../models/layout/side-drop-target";
import { SplitDropTarget } from "../../models/layout/split-drop-target";
import type { Tab } from "../../models/layout/tab";
import { TabDropTarget } from "../../models/layout/tab-drop-target";
import type { TabGroup } from "../../models/layout/tab-group";
import { LayoutService } from "../../services/layout.service";
import { TabLabelService } from "../../services/tab-label.service";

@Component({
  selector: "tr-tab-menu",
  imports: [MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective],
  templateUrl: "./tab-menu.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TabMenuComponent {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly labels: TabLabelService = inject(TabLabelService);
  private readonly document: Document = inject(DOCUMENT);
  private readonly environment: EnvironmentInjector = inject(EnvironmentInjector);

  protected readonly resources: typeof Resources = Resources;
  protected readonly edges: readonly PanelEdge[] = Object.values(PanelEdge);
  protected readonly sides: readonly DockSide[] = Object.values(DockSide);
  protected readonly group: Signal<TabGroup | null> = computed(() => this.layout.layout().groupOf(this.tab()));
  protected readonly destinations: Signal<readonly TabGroup[]> = computed(() => this.layout.layout().groups.filter(t => t.accepts(this.tab()) && !t.has(this.tab())));

  public readonly tab = input.required<Tab>();
  public readonly menu: Signal<TemplateRef<unknown>> = viewChild.required<TemplateRef<unknown>>("tabMenu");

  protected indexIn(group: TabGroup): number {
    return group.tabs.findIndex(t => t.equals(this.tab()));
  }

  protected canSplit(group: TabGroup): boolean {
    return group.isDocuments || group.tabs.length > 1;
  }

  protected labelOf(group: TabGroup): string {
    return group.isDocuments ? Resources.documentsGroupLabel : group.tabs.map(t => this.labels.of(t).title).join(Resources.groupLabelJoiner);
  }

  protected moveTo(group: TabGroup): void {
    this.move(new TabDropTarget(group.id, group.tabs.length));
  }

  protected split(group: TabGroup, edge: PanelEdge): void {
    this.move(new SplitDropTarget(group.id, edge));
  }

  protected dock(side: DockSide): void {
    this.move(new SideDropTarget(side));
  }

  protected shift(group: TabGroup, offset: number): void {
    this.move(new TabDropTarget(group.id, this.indexIn(group) + (offset > 0 ? offset + 1 : offset)));
  }

  protected close(): void {
    const group = this.group();
    this.layout.close(this.tab());
    const next = Object.isNull(group) ? null : this.layout.layout().group(group.id)?.active ?? null;
    if (!Object.isNull(next))
      this.focusTab(next);
  }

  protected closeOthers(group: TabGroup): void {
    this.layout.closeTabs(group.tabs.filter(t => !t.equals(this.tab())));
    this.focusTab(this.tab());
  }

  protected closeToTheRight(group: TabGroup): void {
    this.layout.closeTabs(group.tabs.slice(this.indexIn(group) + 1));
    this.focusTab(this.tab());
  }

  protected closeAll(group: TabGroup): void {
    this.layout.closeTabs(group.tabs);
  }

  protected keep(): void {
    this.layout.keep(this.tab());
  }

  protected reset(): void {
    this.layout.reset();
  }

  private move(target: DropTarget): void {
    this.layout.place(this.tab(), target);
    this.focusTab(this.tab());
  }

  private focusTab(tab: Tab): void {
    afterNextRender(() => [...this.document.querySelectorAll<HTMLElement>(Resources.tabKeySelector)]
      .find(t => t.dataset[Resources.tabKeyData] === tab.key)?.focus(), { injector: this.environment });
  }
}
