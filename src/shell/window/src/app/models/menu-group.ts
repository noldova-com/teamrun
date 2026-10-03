/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { QualifiedName } from "@noldova/teamrun-shell-protocol";

import type { MenuItem } from "./menu-item";
import { Resources } from "../../resources";

export class MenuGroup {
  public readonly name: string;
  public readonly place: string;
  public readonly isExclusive: boolean;
  public readonly items: readonly MenuItem[];
  public readonly isDynamic: boolean;

  public constructor(name: string, place: string, isExclusive: boolean, items: readonly MenuItem[], isDynamic: boolean = false) {
    if (items.length === 0 && !isDynamic)
      throw new ArgumentException(Resources.emptyMenuGroup, Resources.itemsParameter);
    if (items.length > 0 && isDynamic)
      throw new ArgumentException(Resources.itemsInDynamicGroup, Resources.itemsParameter);

    this.name = QualifiedName.parse(name, Resources.nameParameter).text;
    this.place = QualifiedName.parse(place, Resources.placeParameter).text;
    this.isExclusive = isExclusive;
    this.items = [...items];
    this.isDynamic = isDynamic;
  }

  public static dynamic(name: string, place: string, isExclusive: boolean): MenuGroup {
    return new MenuGroup(name, place, isExclusive, [], true);
  }
}
