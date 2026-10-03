/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, ErrorHandler, type Signal, type TemplateRef, computed, inject, input, viewChild } from "@angular/core";

import type { JsonObject } from "@noldova/teamrun-foundation-json";
import { MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective } from "@noldova/teamrun-shell-ui";

import { CommandRow } from "../../models/command-row";
import type { MenuRow } from "../../models/menu-row";
import type { MenuSection } from "../../models/menu-section";
import { SubmenuRow } from "../../models/submenu-row";
import { CommandService } from "../../services/command.service";
import { MenuService } from "../../services/menu.service";

@Component({
  selector: "tr-place-menu",
  imports: [MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective],
  templateUrl: "./place-menu.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaceMenuComponent {
  private readonly menus: MenuService = inject(MenuService);
  private readonly commands: CommandService = inject(CommandService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);

  public readonly place = input.required<string>();
  public readonly context = input<JsonObject>({});
  public readonly menu: Signal<TemplateRef<unknown>> = viewChild.required<TemplateRef<unknown>>("placeMenu");

  protected readonly sections: Signal<readonly MenuSection[]> = computed(() => this.menus.resolve(this.place(), this.context()));

  protected asCommand(row: MenuRow): CommandRow | null {
    return row instanceof CommandRow ? row : null;
  }

  protected asSubmenu(row: MenuRow): SubmenuRow | null {
    return row instanceof SubmenuRow ? row : null;
  }

  protected run(row: CommandRow): void {
    this.commands.runAsync(row.command, row.commandArguments).catch((error: unknown) => this.errors.handleError(error));
  }
}
