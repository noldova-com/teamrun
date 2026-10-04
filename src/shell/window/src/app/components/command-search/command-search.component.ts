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

  private readonly entries: Signal<readonly CommandSearchEntry[]> = computed(() => this.sorted([
    ...this.commands.commands().filter(t => this.commands.isEnabled(t.name)).map(t => this.entryOf(t)),
    ...this.menuBar.searchRows().map(t => new CommandSearchEntry(new QuickInputItem(t.id, t.title, t.icon, t.menu, t.key), () => this.menuBar.run(t.id)))
  ]));

  protected readonly resources: typeof Resources = Resources;
  protected readonly search: CommandSearchService = inject(CommandSearchService);
  protected readonly query: WritableSignal<string> = signal(String.empty);
  protected readonly items: Signal<readonly QuickInputItem[]> = computed(() => {
    const query = this.query();
    return String.isNullOrWhitespace(query) ? this.entries().map(t => t.item) : this.entries().flatMap(t => {
      const found = CommandMatcher.match(query, t.detail, t.item.title);
      return Object.isNull(found) ? [] : [new QuickInputItem(t.item.id, t.item.title, t.item.icon, t.item.detail, t.item.keyLabel, found.titleMatches, found.detailMatches)];
    });
  });

  protected run(item: QuickInputItem): void {
    this.search.remember(item.id);
    this.search.close();
    for (const entry of this.entries().filter(t => t.item.id === item.id).slice(0, 1))
      entry.run();
  }

  private sorted(entries: readonly CommandSearchEntry[]): readonly CommandSearchEntry[] {
    const recent = this.search.recent();
    const rank = (entry: CommandSearchEntry): number => {
      const index = recent.indexOf(entry.item.id);
      return index < 0 ? recent.length : index;
    };
    return [...entries].sort((a, b) => rank(a) - rank(b) || a.detail.localeCompare(b.detail) || a.item.title.localeCompare(b.item.title));
  }

  private entryOf(command: CommandContribution): CommandSearchEntry {
    return new CommandSearchEntry(new QuickInputItem(command.name, command.title, command.icon, this.commands.ownerOf(command.name), this.commands.keyLabel(command.name)),
      () => this.commands.run(command.name));
  }
}
