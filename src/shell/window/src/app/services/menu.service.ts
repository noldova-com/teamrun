/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, Injectable, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonObject } from "@noldova/teamrun-foundation-json";

import { MenuCheck } from "../enums/menu-check";
import { CommandRow } from "../models/command-row";
import type { MenuDeclarations } from "../models/menu-declarations";
import type { MenuGroup } from "../models/menu-group";
import type { MenuItem } from "../models/menu-item";
import type { MenuPlace } from "../models/menu-place";
import { MenuSection } from "../models/menu-section";
import { SubmenuRow } from "../models/submenu-row";
import { WindowPartTokens } from "../models/window-part-tokens";
import { ShellMenus } from "../models/shell-menus";
import { CommandService } from "./command.service";
import { DesktopBridgeService } from "./desktop-bridge.service";

@Injectable({ providedIn: "root" })
export class MenuService {
  private readonly commands: CommandService = inject(CommandService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly declarations: readonly MenuDeclarations[] = inject(WindowPartTokens.menus);
  private readonly activeValue: WritableSignal<readonly string[]> = signal([]);
  private readonly providers: WritableSignal<ReadonlyMap<string, (context: JsonObject) => readonly MenuItem[]>> = signal(new Map());
  private readonly shell: MenuDeclarations = ShellMenus.of(inject(DesktopBridgeService).isMac);

  public readonly active: Signal<readonly MenuDeclarations[]> = computed(() => [
    this.shell,
    ...this.activeValue().flatMap(t => this.declarations.filter(u => u.moduleId === t))
  ]);

  public setActiveModules(moduleIds: readonly string[]): void {
    this.activeValue.set([...moduleIds]);
  }

  public declaresDynamicGroup(moduleId: string, group: string): boolean {
    return this.declarations.some(t => t.moduleId === moduleId && t.groups.some(u => u.name === group && u.isDynamic));
  }

  public provideGroup(group: string, provider: (context: JsonObject) => readonly MenuItem[]): () => void {
    this.providers.update(t => new Map([...t, [group, provider]]));
    return () => this.providers.update(t => t.get(group) === provider ? new Map([...t].filter(u => u[0] !== group)) : t);
  }

  public findPlace(name: string): MenuPlace | null {
    return this.active().flatMap(t => t.places).find(t => t.name === name) ?? null;
  }

  public resolve(place: string, context: JsonObject = {}): readonly MenuSection[] {
    return this.active()
      .flatMap(t => t.groups)
      .filter(t => t.place === place)
      .map(t => new MenuSection(t.name, this.itemsOf(t, context).flatMap(u => this.resolveItem(t, u, context))))
      .filter(t => t.rows.length > 0);
  }

  private itemsOf(group: MenuGroup, context: JsonObject): readonly MenuItem[] {
    if (!group.isDynamic)
      return group.items;
    try {
      return this.providers().get(group.name)?.(context) ?? [];
    }
    catch (error) {
      this.errors.handleError(error);
      return [];
    }
  }

  private resolveItem(group: MenuGroup, item: MenuItem, context: JsonObject): readonly (CommandRow | SubmenuRow)[] {
    if (!Object.isNull(item.submenu)) {
      const place = this.findPlace(item.submenu);
      return Object.isNull(place) || this.resolve(place.name, context).length === 0 ? [] : [new SubmenuRow(place.name, place.title, place.icon)];
    }
    if (!Object.isNull(item.choice))
      return this.resolveChoice(item.choice, context);
    const name = String(item.command);
    const commandArguments = { ...context, ...item.commandArguments };
    const command = this.commands.commands().find(t => t.name === name);
    if (Object.isUndefined(command))
      return [new CommandRow(name, commandArguments, item.label ?? name, null, null, false, MenuCheck.None, false)];
    if (!this.commands.isApplicable(name, commandArguments))
      return [];
    const check = Object.isNull(command.isChecked) ? MenuCheck.None : group.isExclusive ? MenuCheck.Radio : MenuCheck.Checkbox;
    return [new CommandRow(name, commandArguments, item.label ?? command.title, command.icon, this.commands.keyLabel(name), this.commands.isEnabled(name, commandArguments), check,
      this.commands.isChecked(name, commandArguments))];
  }

  private resolveChoice(placeName: string, context: JsonObject): readonly SubmenuRow[] {
    const place = this.findPlace(placeName);
    const rows = Object.isNull(place) ? [] : this.resolve(place.name, context).flatMap(t => t.rows);
    if (Object.isNull(place) || rows.length === 0)
      return [];
    const checked = rows.find(t => !t.isSubmenu && t.isChecked);
    return [new SubmenuRow(place.name, checked?.title ?? place.title, place.icon)];
  }
}
