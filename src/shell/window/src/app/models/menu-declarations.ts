/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";

import { MenuGroup } from "./menu-group";
import { MenuItem } from "./menu-item";
import { MenuPlace } from "./menu-place";
import { Resources } from "../../resources";

export class MenuDeclarations {
  public readonly moduleId: string;
  public readonly places: readonly MenuPlace[];
  public readonly groups: readonly MenuGroup[];

  public constructor(moduleId: string, places: readonly MenuPlace[], groups: readonly MenuGroup[]) {
    this.moduleId = moduleId;
    this.places = [...places];
    this.groups = [...groups];
  }

  public static fromJson(moduleId: string, value: JsonValue): MenuDeclarations {
    const reader = JsonReader.fromValue(value);
    return new MenuDeclarations(
      moduleId,
      reader.readObjectArray(Resources.placesField).map(t => new MenuPlace(t.readString(Resources.nameField), t.readString(Resources.titleField), t.readBoolean(Resources.menuBarField))),
      reader.readObjectArray(Resources.groupsField).map(t => new MenuGroup(
        t.readString(Resources.nameField),
        t.readString(Resources.placeField),
        t.readBoolean(Resources.exclusiveField),
        t.readObjectArray(Resources.itemsField).map(u => u.hasField(Resources.submenuField)
          ? MenuItem.ofSubmenu(u.readString(Resources.submenuField))
          : MenuItem.ofCommand(u.readString(Resources.commandField), u.readObject(Resources.argumentsField).toJson(),
            u.hasField(Resources.labelField) ? u.readString(Resources.labelField) : null)))));
  }
}
