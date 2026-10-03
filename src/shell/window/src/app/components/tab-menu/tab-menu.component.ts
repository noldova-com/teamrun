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
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective } from "@noldova/teamrun-shell-ui";

import { Resources } from "../../../resources";
import { BottomDockSpan } from "../../enums/bottom-dock-span";
import { DockSide } from "../../enums/dock-side";
import { PanelEdge } from "../../enums/panel-edge";
import type { Tab } from "../../models/layout/tab";
import { TabDropTarget } from "../../models/layout/tab-drop-target";
import type { TabGroup } from "../../models/layout/tab-group";
import { CommandService } from "../../services/command.service";
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
  private readonly commands: CommandService = inject(CommandService);
  private readonly labels: TabLabelService = inject(TabLabelService);
  private readonly document: Document = inject(DOCUMENT);
  private readonly environment: EnvironmentInjector = inject(EnvironmentInjector);

  protected readonly resources: typeof Resources = Resources;
  protected readonly edges: readonly PanelEdge[] = Object.values(PanelEdge);
  protected readonly sides: readonly DockSide[] = Object.values(DockSide);
  protected readonly spans: readonly BottomDockSpan[] = Object.values(BottomDockSpan);
  protected readonly group: Signal<TabGroup | null> = computed(() => this.layout.layout().groupOf(this.tab()));
  protected readonly destinations: Signal<readonly TabGroup[]> = computed(() => this.layout.layout().groups.filter(t => t.accepts(this.tab()) && !t.has(this.tab())));

  public readonly tab = input.required<Tab>();
  public readonly menu: Signal<TemplateRef<unknown>> = viewChild.required<TemplateRef<unknown>>("tabMenu");

  protected isEnabled(command: string): boolean {
    return this.commands.isEnabled(command, this.target());
  }

  protected keyOf(command: string): string | null {
    return this.commands.keyLabel(command);
  }

  protected run(command: string): void {
    this.commands.run(command, this.target());
  }

  protected isSpan(span: BottomDockSpan): boolean {
    return this.layout.layout().bottomSpan === span;
  }

  protected setBottomSpan(span: BottomDockSpan): void {
    this.layout.setBottomSpan(span);
  }

  protected canSplit(): boolean {
    return this.isEnabled(Resources.splitTabCommands[PanelEdge.Left]);
  }

  protected labelOf(group: TabGroup): string {
    return group.isDocuments ? Resources.documentsGroupLabel : group.tabs.map(t => this.labels.of(t).title).join(Resources.groupLabelJoiner);
  }

  protected moveTo(group: TabGroup): void {
    const tab = this.tab();
    this.layout.place(tab, new TabDropTarget(group.id, group.tabs.length));
    afterNextRender(() => [...this.document.querySelectorAll<HTMLElement>(Resources.tabKeySelector)]
      .find(t => t.dataset[Resources.tabKeyData] === tab.key)?.focus(), { injector: this.environment });
  }

  private target(): JsonValue {
    return { [Resources.tabArgument]: this.tab().key };
  }
}
