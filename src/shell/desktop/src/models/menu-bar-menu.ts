/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { MenuBarRow } from "./menu-bar-row.js";

export class MenuBarMenu {
  public readonly place: string;
  public readonly title: string;
  public readonly rows: readonly MenuBarRow[];

  private constructor(place: string, title: string, rows: readonly MenuBarRow[]) {
    this.place = place;
    this.title = title;
    this.rows = [...rows];
  }

  public static fromJson(value: unknown): MenuBarMenu {
    const json = JsonReader.fromValue(value);
    return new MenuBarMenu(json.readNonBlankString(Resources.placeField), json.readNonBlankString(Resources.titleField),
      json.readObjectArray(Resources.rowsField).map(t => MenuBarRow.fromJson(t.toJson())));
  }
}
