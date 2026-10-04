/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, computed, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources";
import { ToolbarMove } from "../enums/toolbar-move";
import { MenuItem } from "../models/menu-item";
import type { MenuPlace } from "../models/menu-place";
import { Toolbar } from "../models/toolbar";
import { LayoutService } from "./layout.service";
import { MenuService } from "./menu.service";

@Injectable({ providedIn: "root" })
export class ToolbarService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly menus: MenuService = inject(MenuService);

  public readonly places: Signal<readonly MenuPlace[]> = computed(() => this.menus.active().flatMap(t => t.places).filter(t => !Object.isNull(t.toolbar)));
  private readonly arrangement: Signal<readonly (readonly string[])[]> = computed(() => this.layout.layout().toolbars.shownRows(this.places()));

  public readonly shown: Signal<readonly string[]> = computed(() => this.arrangement().flat());
  public readonly rows: Signal<readonly (readonly Toolbar[])[]> = computed(() => this.arrangement().map(row => row.flatMap(name => this.toolbarsOf(name))));
  public readonly hasContent: Signal<boolean> = computed(() => this.rows().some(row => row.some(t => t.sections.length > 0)));

  public constructor() {
    this.menus.provideGroup(Resources.toolbarListGroup, () => this.places().map(t => MenuItem.ofCommand(Resources.toggleToolbarCommand, { [Resources.toolbarArgument]: t.name }, t.title)));
  }

  public isShown(name: string): boolean {
    return this.shown().includes(name);
  }

  public isKnown(name: string): boolean {
    return this.places().some(t => t.name === name);
  }

  public setShown(name: string, isShown: boolean): void {
    const toolbars = this.layout.layout().toolbars;
    this.layout.setToolbars(isShown ? toolbars.show(name, this.places()) : toolbars.hide(name, this.places()));
  }

  public move(name: string, row: number, index: number): void {
    this.layout.setToolbars(this.layout.layout().toolbars.move(name, row, index, this.places()));
  }

  public moveToNewRow(name: string, row: number): void {
    this.layout.setToolbars(this.layout.layout().toolbars.moveToNewRow(name, row, this.places()));
  }

  public canMove(name: string, move: ToolbarMove): boolean {
    return this.destination(name, move) !== null;
  }

  public moveBy(name: string, move: ToolbarMove): void {
    const destination = this.destination(name, move);
    if (destination === null)
      return;
    if (destination.isNewRow)
      this.moveToNewRow(name, destination.row);
    else
      this.move(name, destination.row, destination.index);
  }

  private destination(name: string, move: ToolbarMove): { readonly row: number; readonly index: number; readonly isNewRow: boolean } | null {
    const rows = this.arrangement();
    const row = rows.findIndex(t => t.includes(name));
    const current = rows[row] ?? [];
    const index = current.indexOf(name);
    const into = (target: number): { readonly row: number; readonly index: number; readonly isNewRow: boolean } =>
      ({ row: target, index: Math.min(index, rows.slice(target, target + 1).flat().length), isNewRow: false });
    const alone = current.length < 2;
    switch (move) {
      case ToolbarMove.Left:
        return index > 0 ? { row, index: index - 1, isNewRow: false } : null;
      case ToolbarMove.Right:
        return index >= 0 && index < current.length - 1 ? { row, index: index + 1, isNewRow: false } : null;
      case ToolbarMove.Up:
        return row > 0 ? into(row - 1) : row === 0 && !alone ? { row: 0, index: 0, isNewRow: true } : null;
      case ToolbarMove.Down:
        return row >= 0 && row < rows.length - 1 ? into(row + 1) : row >= 0 && !alone ? { row: rows.length, index: 0, isNewRow: true } : null;
    }
  }

  private toolbarsOf(name: string): readonly Toolbar[] {
    return this.places().filter(t => t.name === name).map(t => new Toolbar(t.name, t.title, this.menus.resolve(t.name)));
  }
}
