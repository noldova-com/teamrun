/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import type { ColumnType } from "../../enums/column-type.js";
import { Resources } from "../../resources.js";

export class Column {
  public readonly name: string;
  public readonly type: ColumnType;
  public readonly isNullable: boolean;

  public constructor(name: string, type: ColumnType, isNullable: boolean) {
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameParameterName);

    this.name = name;
    this.type = type;
    this.isNullable = isNullable;
  }
}
