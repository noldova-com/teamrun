/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type MenuItem from "./menu-item.ts";

export default class MenuGroup {
  public readonly name: string;
  public readonly place: string;
  public readonly isExclusive: boolean;
  public readonly items: readonly MenuItem[];
  public readonly isDynamic: boolean;

  public constructor(name: string, place: string, isExclusive: boolean, items: readonly MenuItem[], isDynamic: boolean = false) {
    this.name = name;
    this.place = place;
    this.isExclusive = isExclusive;
    this.items = [...items];
    this.isDynamic = isDynamic;
  }

  public toJson(): Readonly<Record<string, unknown>> {
    return this.isDynamic
      ? { name: this.name, place: this.place, exclusive: this.isExclusive, dynamic: true }
      : { name: this.name, place: this.place, exclusive: this.isExclusive, items: this.items.map(t => t.toJson()) };
  }
}
