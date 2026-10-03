/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException, JsonReader } from "@noldova/teamrun-foundation-json";
import { KeyChord } from "@noldova/teamrun-shell-protocol";

import { MenuBarRowType } from "../enums/menu-bar-row-type.js";
import { MenuCheck } from "../enums/menu-check.js";
import { Resources } from "../resources.js";

export class MenuBarRow {
  public readonly type: MenuBarRowType;
  public readonly id: string | null;
  public readonly label: string;
  public readonly key: KeyChord | null;
  public readonly isEnabled: boolean;
  public readonly check: MenuCheck;
  public readonly isChecked: boolean;
  public readonly rows: readonly MenuBarRow[];

  private constructor(type: MenuBarRowType, id: string | null, label: string, key: KeyChord | null, isEnabled: boolean, check: MenuCheck, isChecked: boolean,
    rows: readonly MenuBarRow[]) {
    this.type = type;
    this.id = id;
    this.label = label;
    this.key = key;
    this.isEnabled = isEnabled;
    this.check = check;
    this.isChecked = isChecked;
    this.rows = [...rows];
  }

  public static fromJson(value: unknown): MenuBarRow {
    const json = JsonReader.fromValue(value);
    const type = json.readString(Resources.typeField);
    if (type === MenuBarRowType.Separator)
      return new MenuBarRow(MenuBarRowType.Separator, null, String.empty, null, false, MenuCheck.None, false, []);
    if (type === MenuBarRowType.Submenu)
      return new MenuBarRow(MenuBarRowType.Submenu, null, json.readNonBlankString(Resources.labelField), null, true, MenuCheck.None, false,
        json.readObjectArray(Resources.rowsField).map(t => MenuBarRow.fromJson(t.toJson())));
    if (type !== MenuBarRowType.Command)
      throw new JsonException(Resources.invalidMenuBar, json.path);
    const check = Object.values(MenuCheck).find(t => t === json.readString(Resources.checkField));
    const key = json.readNullableString(Resources.keyField);
    if (Object.isUndefined(check))
      throw new JsonException(Resources.invalidMenuBar, json.path);
    return new MenuBarRow(MenuBarRowType.Command, json.readNonBlankString(Resources.idField), json.readNonBlankString(Resources.labelField),
      Object.isNull(key) ? null : KeyChord.parse(key), json.readBoolean(Resources.enabledField), check, json.readBoolean(Resources.checkedField), []);
  }
}
