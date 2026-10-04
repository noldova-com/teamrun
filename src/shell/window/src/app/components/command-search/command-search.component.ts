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

  private readonly entries: Signal<readonly CommandSearchEntry[]> = computed(() => [
    ...this.commands.commands().filter(t => this.commands.isEnabled(t.name)).map(t => new CommandSearchEntry(this.itemOf(t), () => this.commands.run(t.name))),
    ...this.menuBar.searchRows().map(t => new CommandSearchEntry(new QuickInputItem(t.id, t.title, t.icon, t.menu, t.key), () => this.menuBar.run(t.id)))
  ]);

  protected readonly resources: typeof Resources = Resources;
  protected readonly search: CommandSearchService = inject(CommandSearchService);
  protected readonly query: WritableSignal<string> = signal(String.empty);
  protected readonly items: Signal<readonly QuickInputItem[]> = computed(() => {
    const items = this.entries().map(t => t.item);
    return String.isNullOrWhitespace(this.query()) ? this.unfiltered(items) : this.filtered(items, this.query());
  });

  protected run(item: QuickInputItem): void {
    this.search.remember(item.id);
    this.search.close();
    for (const entry of this.entries().filter(t => t.item.id === item.id).slice(0, 1))
      entry.run();
  }

  private unfiltered(items: readonly QuickInputItem[]): readonly QuickInputItem[] {
    const recent = this.search.recent();
    const rank = (item: QuickInputItem): number => {
      const index = recent.indexOf(item.id);
      return index < 0 ? recent.length : index;
    };
    return [...items].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
  }

  private filtered(items: readonly QuickInputItem[], query: string): readonly QuickInputItem[] {
    return items
      .flatMap(t => {
        const found = CommandMatcher.match(query, t.title);
        return Object.isNull(found) ? [] : [[t, found] as const];
      })
      .sort(([a, first], [b, second]) => first.kind - second.kind || a.title.length - b.title.length || a.title.localeCompare(b.title))
      .map(([item, found]) => new QuickInputItem(item.id, item.title, item.icon, item.detail, item.keyLabel, found.matches));
  }

  private itemOf(command: CommandContribution): QuickInputItem {
    return new QuickInputItem(command.name, command.title, command.icon, this.commands.ownerOf(command.name), this.commands.keyLabel(command.name));
  }
}
