/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class AcpConfigOption {
  public readonly id: string;
  public readonly category: string | null;
  public readonly currentValue: string;
  public readonly values: readonly string[];
  public readonly names: readonly string[];
  public readonly groups: readonly (string | null)[];
  public readonly groupNames: readonly (string | null)[];

  public constructor(id: string, category: string | null, currentValue: string, values: readonly string[], names: readonly string[],
    groups: readonly (string | null)[] = values.map(() => null), groupNames: readonly (string | null)[] = values.map(() => null)) {
    this.id = id;
    this.category = category;
    this.currentValue = currentValue;
    this.values = [...values];
    this.names = [...names];
    this.groups = [...groups];
    this.groupNames = [...groupNames];
  }

  public static readAll(answer: JsonReader): readonly AcpConfigOption[] | null {
    if (!answer.hasField(Resources.acpConfigOptionsField) || Object.isNull(answer.toJson()[Resources.acpConfigOptionsField]))
      return null;
    return answer.readObjectArray(Resources.acpConfigOptionsField).filter(t => t.readOptionalString(Resources.typeField) === Resources.acpSelectType)
      .map(t => {
        const options = t.readObjectArray(Resources.optionsField).flatMap((o): { option: JsonReader; group: string | null; groupName: string | null }[] => o.hasField(Resources.acpGroupField)
          ? o.readObjectArray(Resources.optionsField).map(u => ({ option: u, group: o.readNonBlankString(Resources.acpGroupField),
            groupName: o.readOptionalString(Resources.nameField) ?? null }))
          : [{ option: o, group: null, groupName: null }]);
        return new AcpConfigOption(t.readNonBlankString(Resources.idField), t.readOptionalString(Resources.acpCategoryField) ?? null,
          t.readNonBlankString(Resources.acpCurrentValueField), options.map(o => o.option.readNonBlankString(Resources.acpValueField)),
          options.map(o => o.option.readOptionalString(Resources.nameField) ?? o.option.readNonBlankString(Resources.acpValueField)),
          options.map(o => o.group), options.map(o => o.groupName));
      });
  }

  public withValue(value: string): AcpConfigOption {
    return new AcpConfigOption(this.id, this.category, value, this.values, this.names, this.groups, this.groupNames);
  }

  public nameOf(value: string): string {
    return this.names[this.values.indexOf(value)] ?? value;
  }

  public toLog(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.acpCategoryField]: this.category,
      [Resources.acpCurrentValueField]: this.currentValue,
      [Resources.optionsField]: this.values.map((t, index) => ({ [Resources.acpValueField]: t, [Resources.nameField]: this.names[index]!,
        [Resources.acpGroupField]: this.groups[index]!, [Resources.acpGroupNameField]: this.groupNames[index]! }))
    };
  }
}
