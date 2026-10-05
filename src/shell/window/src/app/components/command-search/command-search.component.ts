/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { QuickInputComponent, QuickInputItem } from "@noldova/teamrun-shell-ui";

import type { CommandContribution } from "../../models/command-contribution";
import { CommandMatcher } from "../../models/command-matcher";
import { CommandSearchEntry } from "../../models/command-search-entry";
import { CommandSearchService } from "../../services/command-search.service";
import { CommandService } from "../../services/command.service";
import { MenuBarService } from "../../services/menu-bar.service";
import { RecentCommandsService } from "../../services/recent-commands.service";
import { SettingsService } from "../../services/settings.service";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-command-search",
  imports: [QuickInputComponent],
  templateUrl: "./command-search.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommandSearchComponent {
  private readonly commands: CommandService = inject(CommandService);
  private readonly menuBar: MenuBarService = inject(MenuBarService);
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly recent: RecentCommandsService = inject(RecentCommandsService);

  private readonly entries: Signal<readonly CommandSearchEntry[]> = computed(() => [
    ...this.commands.commands().filter(t => this.commands.isEnabled(t.name)).map(t => this.entryOf(t)),
    ...this.menuBar.searchRows().map(t => new CommandSearchEntry(new QuickInputItem(t.id, t.title, t.icon, t.menu, null), () => this.menuBar.run(t.id)))
  ].sort((a, b) => a.item.title.localeCompare(b.item.title) || a.detail.localeCompare(b.detail)));
  private readonly recentEntries: Signal<readonly CommandSearchEntry[]> = computed(() => {
    const limit = this.settings.values().get(Resources.recentCommandsSetting);
    const entries = new Map(this.entries().map(t => [t.item.id, t]));
    return this.recent.ids().flatMap(t => entries.get(t) ?? []).slice(0, Object.isNumber(limit) ? limit : 0);
  });

  protected readonly resources: typeof Resources = Resources;
  protected readonly search: CommandSearchService = inject(CommandSearchService);
  protected readonly query: WritableSignal<string> = signal(String.empty);
  protected readonly items: Signal<readonly QuickInputItem[]> = computed(() => {
    const recent = this.recentEntries();
    const recentIds = new Set(recent.map(t => t.item.id));
    const others = this.entries().filter(t => !recentIds.has(t.item.id));
    const query = this.query();
    if (!String.isNullOrWhitespace(query))
      return [...recent, ...others].flatMap(t => {
        const found = CommandMatcher.match(query, t.detail, t.item.title);
        return Object.isNull(found) ? [] : [new QuickInputItem(t.item.id, t.item.title, t.item.icon, t.item.detail, t.item.keyLabel, found.titleMatches, found.detailMatches)];
      });
    if (recent.length === 0)
      return others.map(t => t.item);
    return [
      ...recent.map((t, index) => CommandSearchComponent.inSection(t.item, index === 0 ? Resources.recentlyUsedSection : null)),
      ...others.map((t, index) => CommandSearchComponent.inSection(t.item, index === 0 ? Resources.otherCommandsSection : null))
    ];
  });

  protected run(item: QuickInputItem): void {
    this.recent.record(item.id);
    this.search.close();
    for (const entry of this.entries().filter(t => t.item.id === item.id).slice(0, 1))
      entry.run();
  }

  private entryOf(command: CommandContribution): CommandSearchEntry {
    return new CommandSearchEntry(new QuickInputItem(command.name, command.title, command.icon, this.commands.ownerOf(command.name), this.commands.keyLabel(command.name)),
      () => this.commands.run(command.name));
  }

  private static inSection(item: QuickInputItem, section: string | null): QuickInputItem {
    return Object.isNull(section) ? item : new QuickInputItem(item.id, item.title, item.icon, item.detail, item.keyLabel, item.matches, item.detailMatches, section);
  }
}
