/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "@noldova/teamrun-foundation-core";

import type { ColumnType } from "../../enums/column-type.js";
import type { Column } from "../../models/schema/column.js";
import type { ColumnSelector } from "../../types/column-selector.js";
import { ColumnBuilder } from "./column-builder.js";

export class ColumnsBuilder<TModel> {
  private readonly columns: ColumnBuilder[] = [];

  public column(name: string, type: ColumnType): ColumnBuilder;
  public column(selector: ColumnSelector<TModel>, type: ColumnType): ColumnBuilder;
  public column(nameOrSelector: string | ColumnSelector<TModel>, type: ColumnType): ColumnBuilder {
    const column = new ColumnBuilder(Object.isString(nameOrSelector) ? nameOrSelector : nameof<TModel>(nameOrSelector), type);
    this.columns.push(column);
    return column;
  }

  public toColumns(): readonly Column[] {
    return this.columns.map(t => t.toColumn());
  }
}
