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
  public readonly shown: Signal<readonly string[]> = computed(() => this.layout.layout().toolbars.shownRows(this.places()).flat());
  public readonly rows: Signal<readonly (readonly Toolbar[])[]> = computed(() => this.layout.layout().toolbars.shownRows(this.places()).map(row => row.flatMap(name => this.toolbarsOf(name))));
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

  private toolbarsOf(name: string): readonly Toolbar[] {
    return this.places().filter(t => t.name === name).map(t => new Toolbar(t.name, t.title, this.menus.resolve(t.name)));
  }
}
