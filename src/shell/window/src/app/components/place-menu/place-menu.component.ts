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

import { MenuCheck } from "../../enums/menu-check";
import type { CommandRow } from "../../models/command-row";
import type { MenuSection } from "../../models/menu-section";
import { CommandService } from "../../services/command.service";
import { MenuService } from "../../services/menu.service";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-place-menu",
  imports: [MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective],
  templateUrl: "./place-menu.component.html",
  styleUrl: "./place-menu.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaceMenuComponent {
  private readonly menus: MenuService = inject(MenuService);
  private readonly commands: CommandService = inject(CommandService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);

  public readonly place = input<string>(Resources.noPlace);
  public readonly rows = input<readonly MenuSection[] | null>(null);
  public readonly context = input<JsonObject>({});
  public readonly menu: Signal<TemplateRef<unknown>> = viewChild.required<TemplateRef<unknown>>("placeMenu");

  protected readonly menuCheck: typeof MenuCheck = MenuCheck;
  protected readonly sections: Signal<readonly MenuSection[]> = computed(() => this.rows() ?? this.menus.resolve(this.place(), this.context()));

  protected run(row: CommandRow): void {
    this.commands.runAsync(row.command, row.commandArguments).catch((error: unknown) => this.errors.handleError(error));
  }
}
