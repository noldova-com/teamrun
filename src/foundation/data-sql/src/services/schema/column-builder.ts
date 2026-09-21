/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ColumnType } from "../../enums/column-type.js";
import { Column } from "../../models/schema/column.js";

export class ColumnBuilder {
  private isNullable: boolean = false;

  public readonly name: string;
  public readonly type: ColumnType;

  public constructor(name: string, type: ColumnType) {
    this.name = name;
    this.type = type;
  }

  public nullable(): this {
    this.isNullable = true;
    return this;
  }

  public toColumn(): Column {
    return new Column(this.name, this.type, this.isNullable);
  }
}
