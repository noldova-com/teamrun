/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { MenuBarMenu } from "./menu-bar-menu.js";

export class MenuBar {
  public readonly menus: readonly MenuBarMenu[];

  private constructor(menus: readonly MenuBarMenu[]) {
    this.menus = [...menus];
  }

  public static fromJson(value: unknown): MenuBar {
    return new MenuBar(JsonReader.fromValue(value).readObjectArray(Resources.menusField).map(t => MenuBarMenu.fromJson(t.toJson())));
  }
}
