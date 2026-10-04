/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class MenuSearchRow {
  public readonly id: string;
  public readonly title: string;
  public readonly icon: string | null;
  public readonly menu: string;

  public constructor(id: string, title: string, icon: string | null, menu: string) {
    this.id = id;
    this.title = title;
    this.icon = icon;
    this.menu = menu;
  }
}
