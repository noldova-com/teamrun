/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader, JsonValue } from "@noldova/context.json";

export class SettingDeclaration {
  public readonly name: string;
  public readonly defaultValue: JsonValue;
  public readonly locality: string;
  public readonly minimum: number | null;
  public readonly maximum: number | null;

  public constructor(name: string, defaultValue: JsonValue, locality: string, minimum: number | null = null, maximum: number | null = null) {
    this.name = name;
    this.defaultValue = defaultValue;
    this.locality = locality;
    this.minimum = minimum;
    this.maximum = maximum;
  }

  public static fromJson(reader: JsonReader): SettingDeclaration {
    const type = reader.readObject("type");
    return new SettingDeclaration(reader.readString("name"), reader.readValue("default"), reader.readString("locality"),
      type.hasField("minimum") ? type.readNumber("minimum") : null, type.hasField("maximum") ? type.readNumber("maximum") : null);
  }

  public refuses(value: JsonValue): boolean {
    return Object.isNumber(value) && ((!Object.isNull(this.minimum) && value < this.minimum) || (!Object.isNull(this.maximum) && value > this.maximum));
  }
}
