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
import { EditAction } from "../enums/edit-action";
import { PanelEdge } from "../enums/panel-edge";
import { ToolbarMove } from "../enums/toolbar-move";
import { CommandContribution } from "../models/command-contribution";
import { SideDropTarget } from "../models/layout/side-drop-target";
import { SplitDropTarget } from "../models/layout/split-drop-target";
import type { Tab } from "../models/layout/tab";
import type { TabGroup } from "../models/layout/tab-group";
import { TabDropTarget } from "../models/layout/tab-drop-target";
import { ShellDocuments } from "../models/shell-documents";
import { TabTarget } from "../models/tab-target";
import { Resources } from "../../resources";
import { CommandSearchService } from "./command-search.service";
import { DesktopBridgeService } from "./desktop-bridge.service";
import { EditTargetService } from "./edit-target.service";
import { LayoutService } from "./layout.service";
import { ToolbarService } from "./toolbar.service";
import { TabStripService } from "./tab-strip.service";

@Injectable({ providedIn: "root" })
export class ShellCommandsService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly strips: TabStripService = inject(TabStripService);
  private readonly search: CommandSearchService = inject(CommandSearchService);
  private readonly edits: EditTargetService = inject(EditTargetService);
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly document: Document = inject(DOCUMENT);
  private readonly environment: EnvironmentInjector = inject(EnvironmentInjector);

  private get toolbars(): ToolbarService {
    return this.environment.get(ToolbarService);
  }

  public readonly commands: readonly CommandContribution[] = [
    this.tabCommand(Resources.closeTabCommand, Resources.closeTabTitle, Resources.closeGlyph, t => this.close(t), () => true),
    this.tabCommand(Resources.keepTabCommand, Resources.keepTabTitle, Resources.keepGlyph, t => this.layout.keep(t.tab), t => t.isPreview, t => t.isPreview),
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
      t => this.place(t.tab, new SplitDropTarget(t.group.id, edge)), t => t.canSplit, t => t.tab.isMovable)),
    ...Object.values(DockSide).map(side => this.tabCommand(Resources.dockTabCommands[side], Resources.dockTabTitles[side], Resources.dockGlyphs[side],
      t => this.place(t.tab, new SideDropTarget(side)), t => t.tab.isMovable, t => t.tab.isMovable)),
    new CommandContribution(Resources.moveTabToGroupCommand, Resources.moveTabToGroupTitle, Resources.moveToGlyph, null,
      commandArguments => this.done(() => {
        const move = this.moveOf(commandArguments);
        if (!Object.isNull(move))
          this.place(move.target.tab, new TabDropTarget(move.group.id, move.group.tabs.length));
      }),
      commandArguments => !Object.isNull(this.moveOf(commandArguments)), null,
      commandArguments => this.targetOf(commandArguments)?.tab.isMovable ?? false),
    ...Object.values(DockSide).map(side => new CommandContribution(Resources.toggleDockCommands[side], Resources.toggleDockTitles[side], Resources.hideDockGlyphs[side], null,
      () => this.done(() => this.layout.toggleDock(side)), () => true, () => this.layout.layout().dock(side).isExpanded)),
    ...Object.values(EditAction).map(action => new CommandContribution(Resources.editCommands[action], Resources.editTitles[action], Resources.editGlyphs[action], null,
      () => this.editAsync(action), () => this.edits.canRun(action))),
    new CommandContribution(Resources.showCommandsCommand, Resources.showCommandsTitle, Resources.showCommandsGlyph, null,
      () => this.done(() => this.search.open())),
    new CommandContribution(Resources.openSettingsCommand, Resources.openSettingsTitle, Resources.settingsGlyph, null,
      () => this.done(() => this.layout.openDocument(ShellDocuments.settingsTab)),
      () => this.layout.registry().hasDocument(ShellDocuments.settings.name)),
    new CommandContribution(Resources.toggleToolbarCommand, Resources.toggleToolbarTitle, Resources.focusToolbarsGlyph, null,
      commandArguments => this.done(() => {
        const name = this.toolbarOf(commandArguments);
        if (!Object.isNull(name))
          this.toolbars.setShown(name, !this.toolbars.isShown(name));
      }),
      commandArguments => !Object.isNull(this.toolbarOf(commandArguments)),
      commandArguments => {
        const name = this.toolbarOf(commandArguments);
        return !Object.isNull(name) && this.toolbars.isShown(name);
      }),
    ...Object.values(ToolbarMove).map(move => new CommandContribution(Resources.moveToolbarCommands[move], Resources.moveToolbarTitles[move], Resources.moveToolbarGlyphs[move], null,
      commandArguments => this.done(() => {
        const name = this.toolbarOf(commandArguments);
        if (!Object.isNull(name)) {
          this.toolbars.moveBy(name, move);
          this.focusGrip(name);
        }
      }),
      commandArguments => {
        const name = this.toolbarOf(commandArguments);
        return !Object.isNull(name) && this.toolbars.canMove(name, move);
      })),
    new CommandContribution(Resources.hideToolbarCommand, Resources.hideToolbarTitle, Resources.hideToolbarGlyph, null,
      commandArguments => this.done(() => {
        const name = this.toolbarOf(commandArguments);
        if (!Object.isNull(name)) {
          const index = this.gripsOf().findIndex(t => t.closest<HTMLElement>(Resources.toolbarSelector)?.dataset[Resources.toolbarData] === name);
          this.toolbars.setShown(name, false);
          this.focusAfterHide(index);
        }
      }),
      commandArguments => !Object.isNull(this.toolbarOf(commandArguments))),
    new CommandContribution(Resources.focusToolbarsCommand, Resources.focusToolbarsTitle, Resources.focusToolbarsGlyph, null,
      () => this.done(() => this.focusToolbars()), () => this.toolbars.hasContent()),
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

  private tabCommand(name: string, title: string, icon: string, run: (target: TabTarget) => void, isEnabled: (target: TabTarget) => boolean,
    isApplicable: (target: TabTarget) => boolean = ShellCommandsService.always): CommandContribution {
    const holds = (commandArguments: JsonValue, rule: (target: TabTarget) => boolean): boolean => {
      const target = this.targetOf(commandArguments);
      return !Object.isNull(target) && rule(target);
    };
    return new CommandContribution(name, title, icon, null,
      commandArguments => this.done(() => {
        const target = this.targetOf(commandArguments);
        if (!Object.isNull(target) && isEnabled(target))
          run(target);
      }),
      commandArguments => holds(commandArguments, isEnabled), null,
      commandArguments => holds(commandArguments, isApplicable));
  }

  private static always(): boolean {
    return true;
  }

  private moveOf(commandArguments: JsonValue): { readonly target: TabTarget; readonly group: TabGroup } | null {
    const target = this.targetOf(commandArguments);
    if (Object.isNull(target) || Object.isNull(commandArguments))
      return null;
    const reader = JsonReader.fromValue(commandArguments);
    const group = reader.hasField(Resources.groupArgument) ? this.layout.layout().group(reader.readInteger(Resources.groupArgument)) : null;
    return Object.isNull(group) || !group.accepts(target.tab) || group.has(target.tab) ? null : { target, group };
  }

  private targetOf(commandArguments: JsonValue): TabTarget | null {
    const layout = this.layout.layout();
    const key = this.tabKeyOf(commandArguments);
    const tab = Object.isUndefined(key) ? this.layout.currentGroup().active : layout.groups.flatMap(t => t.tabs).find(t => t.key === key) ?? null;
    const group = Object.isNull(tab) ? null : layout.groupOf(tab);
    return Object.isNull(tab) || Object.isNull(group) ? null : new TabTarget(tab, group);
  }

  private toolbarOf(commandArguments: JsonValue): string | null {
    const name = Object.isNull(commandArguments) ? undefined : JsonReader.fromValue(commandArguments).readOptionalString(Resources.toolbarArgument);
    return !Object.isUndefined(name) && this.toolbars.isKnown(name) ? name : null;
  }

  private focusGrip(name: string): void {
    afterNextRender(() => [...this.document.querySelectorAll<HTMLElement>(Resources.toolbarSelector)]
      .find(t => t.dataset[Resources.toolbarData] === name)?.querySelector<HTMLElement>(Resources.toolbarGripSelector)?.focus(), { injector: this.environment });
  }

  private gripsOf(): readonly HTMLElement[] {
    return [...this.document.querySelectorAll<HTMLElement>(Resources.toolbarGripSelector)];
  }

  private focusAfterHide(index: number): void {
    afterNextRender(() => {
      const grips = this.gripsOf();
      (grips[index] ?? grips.at(-1) ?? this.document.querySelector<HTMLElement>(Resources.commandSearchButtonSelector))?.focus();
    }, { injector: this.environment });
  }

  private focusToolbars(): void {
    this.document.querySelector<HTMLElement>(Resources.toolbarItemSelector)?.focus();
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

  private async editAsync(action: EditAction): Promise<JsonValue> {
    if (this.edits.canRun(action) && await this.edits.restoreAsync())
      await this.bridge.editAsync(action);
    return null;
  }

  private done(action: () => void): Promise<JsonValue> {
    action();
    return Promise.resolve(null);
  }
}
