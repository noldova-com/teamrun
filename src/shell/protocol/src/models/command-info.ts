/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { KeyChord } from "./key-chord.js";
import { QualifiedName } from "./qualified-name.js";

export class CommandInfo {
  public readonly name: QualifiedName;
  public readonly title: string;
  public readonly icon: string | null;
  public readonly defaultKey: KeyChord | null;
  public readonly isEnabled: boolean;
  public readonly isChecked: boolean | null;

  public constructor(name: QualifiedName, title: string, icon: string | null, defaultKey: KeyChord | null, isEnabled: boolean = true, isChecked: boolean | null = null) {
    if (String.isNullOrWhitespace(title))
      throw new ArgumentException(Resources.commandTitleInvalid, Resources.titleField);
    if (!Object.isNull(icon) && String.isNullOrWhitespace(icon))
      throw new ArgumentException(Resources.commandIconInvalid, Resources.iconField);

    this.name = name;
    this.title = title;
    this.icon = icon;
    this.defaultKey = defaultKey;
    this.isEnabled = isEnabled;
    this.isChecked = isChecked;
  }

  public static fromJson(value: unknown, path?: string): CommandInfo {
    const reader = JsonReader.fromValue(value, path);
    return WireContract.create(reader, () => new CommandInfo(
      QualifiedName.parse(reader.readString(Resources.nameField), Resources.nameField),
      reader.readString(Resources.titleField),
      reader.hasField(Resources.iconField) ? reader.readString(Resources.iconField) : null,
      reader.hasField(Resources.defaultKeyField) ? KeyChord.parseDefault(reader.readString(Resources.defaultKeyField), Resources.defaultKeyField) : null,
      reader.hasField(Resources.isEnabledField) ? reader.readBoolean(Resources.isEnabledField) : true,
      reader.hasField(Resources.isCheckedField) ? reader.readBoolean(Resources.isCheckedField) : null));
  }

  public toJson(): JsonObject {
    return {
      [Resources.nameField]: this.name.text,
      [Resources.titleField]: this.title,
      ...Object.isNull(this.icon) ? {} : { [Resources.iconField]: this.icon },
      ...Object.isNull(this.defaultKey) ? {} : { [Resources.defaultKeyField]: this.defaultKey.text },
      ...this.isEnabled ? {} : { [Resources.isEnabledField]: false },
      ...Object.isNull(this.isChecked) ? {} : { [Resources.isCheckedField]: this.isChecked }
    };
  }
}
