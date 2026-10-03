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
import { WindowPartTokens } from "../../models/window-part-tokens";
import { CommandSearchService } from "../../services/command-search.service";
import { CommandService } from "../../services/command.service";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-command-search",
  imports: [QuickInputComponent],
  templateUrl: "./command-search.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommandSearchComponent {
  private readonly commands: CommandService = inject(CommandService);
  private readonly ownerNames: ReadonlyMap<string, string> = new Map([
    [Resources.shellOwner, Resources.productName],
    ...inject(WindowPartTokens.sources).map(t => [t.moduleId, t.displayName] as const)
  ]);

  protected readonly resources: typeof Resources = Resources;
  protected readonly search: CommandSearchService = inject(CommandSearchService);
  protected readonly query: WritableSignal<string> = signal(String.empty);
  protected readonly items: Signal<readonly QuickInputItem[]> = computed(() => {
    const enabled = this.commands.commands().filter(t => t.isEnabled(null));
    return String.isNullOrWhitespace(this.query()) ? this.unfiltered(enabled) : this.filtered(enabled, this.query());
  });

  protected run(item: QuickInputItem): void {
    this.search.remember(item.id);
    this.search.close();
    this.commands.run(item.id);
  }

  private unfiltered(commands: readonly CommandContribution[]): readonly QuickInputItem[] {
    const recent = this.search.recent();
    const rank = (command: CommandContribution): number => {
      const index = recent.indexOf(command.name);
      return index < 0 ? recent.length : index;
    };
    return [...commands].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title)).map(t => this.itemOf(t, []));
  }

  private filtered(commands: readonly CommandContribution[], query: string): readonly QuickInputItem[] {
    return commands
      .flatMap(t => {
        const found = CommandMatcher.match(query, t.title);
        return Object.isNull(found) ? [] : [[t, found] as const];
      })
      .sort(([a, first], [b, second]) => first.kind - second.kind || a.title.length - b.title.length || a.title.localeCompare(b.title))
      .map(([command, found]) => this.itemOf(command, found.matches));
  }

  private itemOf(command: CommandContribution, matches: readonly number[]): QuickInputItem {
    const owner = command.name.slice(0, command.name.indexOf(Resources.contributionSeparator));
    return new QuickInputItem(command.name, command.title, command.icon, this.ownerNames.get(owner) ?? owner, this.commands.keyLabel(command.name), matches);
  }
}
