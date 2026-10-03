/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, ErrorHandler, type Signal, computed, inject, input } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { TooltipDirective } from "@noldova/teamrun-shell-ui";

import type { StatusBarItem } from "../../models/status-bar-item";
import type { StatusBarItemState } from "../../models/status-bar-item-state";
import { CommandService } from "../../services/command.service";

@Component({
  selector: "tr-status-bar-item",
  imports: [TooltipDirective],
  templateUrl: "./status-bar-item.component.html",
  styleUrl: "./status-bar-item.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[attr.data-tr-item]": "item().name",
    "[class.tr-status-bar-item-hidden]": "state().isHidden"
  }
})
export class StatusBarItemComponent {
  private readonly commands: CommandService = inject(CommandService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);

  public readonly item = input.required<StatusBarItem>();

  protected readonly state: Signal<StatusBarItemState> = computed(() => this.item().state());
  protected readonly isAvailable: Signal<boolean> = computed(() => {
    const command = this.state().command;
    return !Object.isNull(command) && this.commands.commands().some(t => t.name === command);
  });

  protected run(): void {
    const state = this.state();
    if (Object.isNull(state.command))
      return;
    this.commands.runAsync(state.command, state.commandArguments).catch((error: unknown) => this.errors.handleError(error));
  }
}
