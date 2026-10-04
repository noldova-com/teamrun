/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, computed, inject } from "@angular/core";

import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";

import type { CommandRow } from "../models/command-row";
import type { MenuPlace } from "../models/menu-place";
import { MenuSearchRow } from "../models/menu-search-row";
import { CommandService } from "./command.service";
import { MenuService } from "./menu.service";
import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class MenuBarService {
  private static readonly LEADING: readonly string[] = [Resources.fileMenu, Resources.editMenu, Resources.viewMenu];
  private static readonly TRAILING: readonly string[] = [Resources.windowMenu, Resources.helpMenu];

  private readonly menus: MenuService = inject(MenuService);
  private readonly commands: CommandService = inject(CommandService);

  public readonly places: Signal<readonly MenuPlace[]> = computed(() => {
    const places = this.menus.active().flatMap(t => t.places).filter(t => t.isMenuBar);
    const named = (names: readonly string[]): readonly MenuPlace[] => names.flatMap(t => places.filter(u => u.name === t));
    const shell = [...MenuBarService.LEADING, ...MenuBarService.TRAILING];
    return [...named(MenuBarService.LEADING), ...places.filter(t => !shell.includes(t.name)), ...named(MenuBarService.TRAILING)];
  });

  public readonly shownPlaces: Signal<readonly MenuPlace[]> = computed(() => this.places().filter(t => this.menus.resolve(t.name).length > 0));

  public readonly tree: Signal<JsonObject> = computed(() => ({
    [Resources.menusField]: [...this.menus.active().flatMap(t => t.places).filter(t => t.name === Resources.appMenu), ...this.places()].map(t => ({ [Resources.placeField]: t.name, [Resources.titleField]: t.title, [Resources.rowsField]: this.rowsOf([t.name]) }))
  }));

  public readonly searchRows: Signal<readonly MenuSearchRow[]> = computed(() => this.places().flatMap(t => this.searchRowsOf([t.name], [t.title])));

  public run(id: string): void {
    const row = this.find(id.split(Resources.menuRowPathSeparator));
    if (!Object.isNull(row) && row.isEnabled && !this.commands.isHeldByDialog(row.command))
      this.commands.run(row.command, row.commandArguments);
  }

  private rowsOf(path: readonly string[]): JsonValue[] {
    return this.menus.resolve(String(path.at(-1))).flatMap((section, index) => [
      ...index === 0 ? [] : [{ [Resources.typeField]: Resources.separatorRowType }],
      ...section.rows.map((row, position) => {
        const rowPath = [...path, section.group, String(position)];
        return row.isSubmenu
          ? { [Resources.typeField]: Resources.submenuRowType, [Resources.labelField]: row.title, [Resources.rowsField]: this.rowsOf([...rowPath, row.place]) }
          : {
            [Resources.typeField]: Resources.commandRowType,
            [Resources.idField]: rowPath.join(Resources.menuRowPathSeparator),
            [Resources.labelField]: row.title,
            [Resources.keyField]: this.commands.shortcuts().keyOf(row.command)?.text ?? null,
            [Resources.enabledField]: row.isEnabled,
            [Resources.checkField]: row.check,
            [Resources.checkedField]: row.isChecked
          };
      })
    ]);
  }

  private searchRowsOf(path: readonly string[], titles: readonly string[]): readonly MenuSearchRow[] {
    return this.menus.resolve(String(path.at(-1))).flatMap(section => section.rows.flatMap((row, position) => {
      const rowPath = [...path, section.group, String(position)];
      if (row.isSubmenu)
        return this.searchRowsOf([...rowPath, row.place], [...titles, row.title]);
      return row.isEnabled && Object.keys(row.commandArguments).length > 0
        ? [new MenuSearchRow(rowPath.join(Resources.menuRowPathSeparator), row.title, row.icon, titles.join(Resources.menuTitleSeparator))]
        : [];
    }));
  }

  private find(path: readonly string[]): CommandRow | null {
    let place = String(path[0]);
    for (let index = 1; index + 1 < path.length; index += 3) {
      const row = this.menus.resolve(place).find(t => t.group === path[index])?.rows[Number(path[index + 1])];
      if (Object.isUndefined(row))
        return null;
      if (index + 2 === path.length)
        return row.isSubmenu ? null : row;
      if (!row.isSubmenu || row.place !== path[index + 2])
        return null;
      place = row.place;
    }
    return null;
  }
}
