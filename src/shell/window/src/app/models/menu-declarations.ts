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
import { ToolbarPlacement } from "./toolbar-placement";
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
      reader.readObjectArray(Resources.placesField).map(t => MenuDeclarations.readPlace(t)),
      reader.readObjectArray(Resources.groupsField).map(t => MenuDeclarations.readGroup(t)));
  }

  private static readPlace(reader: JsonReader): MenuPlace {
    const shows = reader.hasField(Resources.showsField) ? reader.readString(Resources.showsField) : null;
    const toolbar = shows === Resources.showsToolbar
      ? new ToolbarPlacement(reader.readBoolean(Resources.shownField), reader.readOptionalString(Resources.afterField) ?? null,
        reader.readOptionalString(Resources.beforeField) ?? null, reader.hasField(Resources.newRowField) && reader.readBoolean(Resources.newRowField))
      : null;
    return new MenuPlace(reader.readString(Resources.nameField), reader.readString(Resources.titleField), shows === Resources.showsMenuBar, null, toolbar);
  }

  private static readGroup(reader: JsonReader): MenuGroup {
    const name = reader.readString(Resources.nameField);
    const place = reader.readString(Resources.placeField);
    const isExclusive = reader.readBoolean(Resources.exclusiveField);
    if (reader.hasField(Resources.dynamicField) && reader.readBoolean(Resources.dynamicField))
      return MenuGroup.dynamic(name, place, isExclusive);
    return new MenuGroup(name, place, isExclusive, reader.readObjectArray(Resources.itemsField).map(t => MenuDeclarations.readItem(t)));
  }

  private static readItem(reader: JsonReader): MenuItem {
    if (reader.hasField(Resources.submenuField))
      return MenuItem.ofSubmenu(reader.readString(Resources.submenuField));
    if (reader.hasField(Resources.choiceField))
      return MenuItem.ofChoice(reader.readString(Resources.choiceField));
    return MenuItem.ofCommand(reader.readString(Resources.commandField), reader.readObject(Resources.argumentsField).toJson(),
      reader.hasField(Resources.labelField) ? reader.readString(Resources.labelField) : null);
  }
}
