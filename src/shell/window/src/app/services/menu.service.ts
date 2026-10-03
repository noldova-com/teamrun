/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonObject } from "@noldova/teamrun-foundation-json";

import { MenuCheck } from "../enums/menu-check";
import { CommandRow } from "../models/command-row";
import type { MenuDeclarations } from "../models/menu-declarations";
import type { MenuGroup } from "../models/menu-group";
import type { MenuItem } from "../models/menu-item";
import type { MenuPlace } from "../models/menu-place";
import type { MenuRow } from "../models/menu-row";
import { MenuSection } from "../models/menu-section";
import { SubmenuRow } from "../models/submenu-row";
import { WindowPartTokens } from "../models/window-part-tokens";
import { ShellMenus } from "../models/shell-menus";
import { CommandService } from "./command.service";

@Injectable({ providedIn: "root" })
export class MenuService {
  private readonly commands: CommandService = inject(CommandService);
  private readonly declarations: readonly MenuDeclarations[] = inject(WindowPartTokens.menus);
  private readonly activeValue: WritableSignal<readonly string[]> = signal([]);

  public readonly active: Signal<readonly MenuDeclarations[]> = computed(() => [
    ShellMenus.declarations,
    ...this.activeValue().flatMap(t => this.declarations.filter(u => u.moduleId === t))
  ]);

  public setActiveModules(moduleIds: readonly string[]): void {
    this.activeValue.set([...moduleIds]);
  }

  public findPlace(name: string): MenuPlace | null {
    return this.active().flatMap(t => t.places).find(t => t.name === name) ?? null;
  }

  public resolve(place: string, context: JsonObject = {}): readonly MenuSection[] {
    return this.active()
      .flatMap(t => t.groups)
      .filter(t => t.place === place)
      .map(t => new MenuSection(t.name, t.items.flatMap(u => this.resolveItem(t, u, context))))
      .filter(t => t.rows.length > 0);
  }

  private resolveItem(group: MenuGroup, item: MenuItem, context: JsonObject): readonly MenuRow[] {
    if (!Object.isNull(item.submenu)) {
      const place = this.findPlace(item.submenu);
      return Object.isNull(place) ? [] : [new SubmenuRow(place.name, place.title)];
    }
    const name = String(item.command);
    const commandArguments = { ...context, ...item.commandArguments };
    const command = this.commands.commands().find(t => t.name === name);
    if (Object.isUndefined(command))
      return [new CommandRow(name, commandArguments, name, null, null, false, MenuCheck.None, false)];
    const check = Object.isNull(command.isChecked) ? MenuCheck.None : group.isExclusive ? MenuCheck.Radio : MenuCheck.Checkbox;
    return [new CommandRow(name, commandArguments, command.title, command.icon, this.commands.keyLabel(name), command.isEnabled(commandArguments), check,
      command.isChecked?.(commandArguments) ?? false)];
  }
}
