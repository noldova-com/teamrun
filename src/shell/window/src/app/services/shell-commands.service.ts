/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { EnvironmentInjector, Injectable, afterNextRender, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";
import { KeyChord } from "@noldova/teamrun-shell-protocol";

import { BottomDockSpan } from "../enums/bottom-dock-span";
import { DockSide } from "../enums/dock-side";
import { PanelEdge } from "../enums/panel-edge";
import { CommandContribution } from "../models/command-contribution";
import { SideDropTarget } from "../models/layout/side-drop-target";
import { SplitDropTarget } from "../models/layout/split-drop-target";
import type { Tab } from "../models/layout/tab";
import { TabDropTarget } from "../models/layout/tab-drop-target";
import { TabTarget } from "../models/tab-target";
import { Resources } from "../../resources";
import { CommandSearchService } from "./command-search.service";
import { LayoutService } from "./layout.service";
import { TabStripService } from "./tab-strip.service";

@Injectable({ providedIn: "root" })
export class ShellCommandsService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly strips: TabStripService = inject(TabStripService);
  private readonly search: CommandSearchService = inject(CommandSearchService);
  private readonly document: Document = inject(DOCUMENT);
  private readonly environment: EnvironmentInjector = inject(EnvironmentInjector);

  public readonly commands: readonly CommandContribution[] = [
    this.tabCommand(Resources.closeTabCommand, Resources.closeTabTitle, Resources.closeGlyph, t => this.close(t), () => true),
    this.tabCommand(Resources.keepTabCommand, Resources.keepTabTitle, Resources.keepGlyph, t => this.layout.keep(t.tab), t => t.tab.equals(t.group.preview)),
    this.tabCommand(Resources.closeOtherTabsCommand, Resources.closeOtherTabsTitle, Resources.closeOthersGlyph,
      t => this.closeKeeping(t.group.tabs.filter(u => !u.equals(t.tab)), t.tab), t => t.group.tabs.length > 1),
    this.tabCommand(Resources.closeTabsToTheRightCommand, Resources.closeTabsToTheRightTitle, Resources.closeToTheRightGlyph,
      t => this.closeKeeping(t.group.tabs.slice(t.index + 1), t.tab), t => !t.isLast),
    this.tabCommand(Resources.closeAllTabsCommand, Resources.closeAllTabsTitle, Resources.closeAllGlyph, t => this.layout.closeTabs(t.group.tabs), () => true),
    this.tabCommand(Resources.moveTabLeftCommand, Resources.moveTabLeftTitle, Resources.moveEarlierGlyph,
      t => this.place(t.tab, new TabDropTarget(t.group.id, t.index - 1)), t => !t.isFirst),
    this.tabCommand(Resources.moveTabRightCommand, Resources.moveTabRightTitle, Resources.moveLaterGlyph,
      t => this.place(t.tab, new TabDropTarget(t.group.id, t.index + 2)), t => !t.isLast),
    this.tabCommand(Resources.nextTabCommand, Resources.nextTabTitle, Resources.nextTabGlyph, t => this.show(t, 1), t => t.group.tabs.length > 1),
    this.tabCommand(Resources.previousTabCommand, Resources.previousTabTitle, Resources.previousTabGlyph, t => this.show(t, -1), t => t.group.tabs.length > 1),
    ...Object.values(PanelEdge).map(edge => this.tabCommand(Resources.splitTabCommands[edge], Resources.splitTabTitles[edge], Resources.splitGlyphs[edge],
      t => this.place(t.tab, new SplitDropTarget(t.group.id, edge)), t => t.canSplit)),
    ...Object.values(DockSide).map(side => this.tabCommand(Resources.dockTabCommands[side], Resources.dockTabTitles[side], Resources.dockGlyphs[side],
      t => this.place(t.tab, new SideDropTarget(side)), t => t.tab.isMovable)),
    ...Object.values(DockSide).map(side => new CommandContribution(Resources.toggleDockCommands[side], Resources.toggleDockTitles[side], Resources.hideDockGlyphs[side], null,
      () => this.done(() => this.layout.toggleDock(side)), () => true, () => this.layout.layout().dock(side).isExpanded)),
    new CommandContribution(Resources.showCommandsCommand, Resources.showCommandsTitle, Resources.showCommandsGlyph, null,
      () => this.done(() => this.search.open())),
    new CommandContribution(Resources.resetLayoutCommand, Resources.resetLayoutLabel, Resources.resetLayoutGlyph, null, () => this.done(() => this.layout.reset())),
    ...Object.values(BottomDockSpan).map(span => new CommandContribution(Resources.bottomSpanCommands[span], Resources.bottomSpanLabels[span], Resources.bottomSpanGlyphs[span], null,
      () => this.done(() => this.layout.setBottomSpan(span)), () => true, () => this.layout.layout().bottomSpan === span)),
    new CommandContribution(Resources.showAllTabsCommand, Resources.overflowLabel, Resources.overflowGlyph, null,
      commandArguments => this.done(() => {
        const group = this.groupOf(commandArguments);
        if (!Object.isNull(group) && this.strips.isOverflowing(group))
          this.strips.showList(group);
      }),
      commandArguments => {
        const group = this.groupOf(commandArguments);
        return !Object.isNull(group) && this.strips.isOverflowing(group);
      })
  ];

  public keys(platform: string): readonly (readonly [KeyChord, string])[] {
    return Resources.shellKeys.flatMap(([command, standard, mac]) => (platform === Resources.macPlatform ? mac : standard).map(t => [KeyChord.parse(t), command] as const));
  }

  private tabCommand(name: string, title: string, icon: string, run: (target: TabTarget) => void, isEnabled: (target: TabTarget) => boolean): CommandContribution {
    return new CommandContribution(name, title, icon, null,
      commandArguments => this.done(() => {
        const target = this.targetOf(commandArguments);
        if (!Object.isNull(target) && isEnabled(target))
          run(target);
      }),
      commandArguments => {
        const target = this.targetOf(commandArguments);
        return !Object.isNull(target) && isEnabled(target);
      });
  }

  private targetOf(commandArguments: JsonValue): TabTarget | null {
    const layout = this.layout.layout();
    const key = this.tabKeyOf(commandArguments);
    const tab = Object.isUndefined(key) ? this.layout.currentGroup().active : layout.groups.flatMap(t => t.tabs).find(t => t.key === key) ?? null;
    const group = Object.isNull(tab) ? null : layout.groupOf(tab);
    return Object.isNull(tab) || Object.isNull(group) ? null : new TabTarget(tab, group);
  }

  private groupOf(commandArguments: JsonValue): number | null {
    return Object.isUndefined(this.tabKeyOf(commandArguments)) ? this.layout.currentGroup().id : this.targetOf(commandArguments)?.group.id ?? null;
  }

  private tabKeyOf(commandArguments: JsonValue): string | undefined {
    return Object.isNull(commandArguments) ? undefined : JsonReader.fromValue(commandArguments).readOptionalString(Resources.tabArgument);
  }

  private close(target: TabTarget): void {
    this.layout.close(target.tab);
    const next = this.layout.layout().group(target.group.id)?.active ?? null;
    if (!Object.isNull(next))
      this.focus(next);
  }

  private show(target: TabTarget, step: number): void {
    const count = target.group.tabs.length;
    const index = (target.index + step + count) % count;
    for (const tab of target.group.tabs.slice(index, index + 1)) {
      this.layout.activate(tab);
      this.focus(tab);
    }
  }

  private closeKeeping(tabs: readonly Tab[], kept: Tab): void {
    this.layout.closeTabs(tabs);
    this.focus(kept);
  }

  private place(tab: Tab, target: TabDropTarget | SplitDropTarget | SideDropTarget): void {
    this.layout.place(tab, target);
    this.focus(tab);
  }

  private focus(tab: Tab): void {
    afterNextRender(() => [...this.document.querySelectorAll<HTMLElement>(Resources.tabKeySelector)]
      .find(t => t.dataset[Resources.tabKeyData] === tab.key)?.focus(), { injector: this.environment });
  }

  private done(action: () => void): Promise<JsonValue> {
    action();
    return Promise.resolve(null);
  }
}
