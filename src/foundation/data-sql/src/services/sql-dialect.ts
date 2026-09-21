/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { Index } from "@noldova/teamrun-foundation-data";

import type { ColumnType } from "../enums/column-type.js";
import type { Column } from "../models/schema/column.js";
import type { ForeignKey } from "../models/schema/foreign-key.js";
import type { PrimaryKey } from "../models/schema/primary-key.js";
import type { Table } from "../models/schema/table.js";
import { Resources } from "../resources.js";

export abstract class SqlDialect {
  public abstract formatColumnType(type: ColumnType): string;

  public renderCreateTable(table: Table): string {
    const definitions = table.columns.map(t => this.renderColumn(t));
    if (!Object.isNull(table.primaryKey))
      definitions.push(this.renderPrimaryKey(table.primaryKey));
    for (const foreignKey of table.foreignKeys)
      definitions.push(this.renderForeignKey(foreignKey));
    return [Resources.createTable, table.name, this.renderList(definitions)].join(Resources.wordSeparator);
  }

  public renderCreateIndex(index: Index): string {
    const keyword = index.isUnique ? Resources.createUniqueIndex : Resources.createIndex;
    return [keyword, index.name, Resources.onKeyword, index.container, this.renderList(index.fields)].join(Resources.wordSeparator);
  }

  public renderColumn(column: Column): string {
    const parts = [column.name, this.formatColumnType(column.type)];
    if (!column.isNullable)
      parts.push(Resources.notNullConstraint);
    return parts.join(Resources.wordSeparator);
  }

  public renderPrimaryKey(primaryKey: PrimaryKey): string {
    return [Resources.primaryKeyConstraint, this.renderList(primaryKey.columns)].join(Resources.wordSeparator);
  }

  public renderForeignKey(foreignKey: ForeignKey): string {
    const columns = this.renderList([foreignKey.column]);
    const principalColumns = this.renderList([foreignKey.principalColumn]);
    return [Resources.foreignKeyConstraint, columns, Resources.referencesConstraint, foreignKey.principalTable, principalColumns].join(Resources.wordSeparator);
  }

  private renderList(items: readonly string[]): string {
    return Resources.openParenthesis + items.join(Resources.listSeparator) + Resources.closeParenthesis;
  }
}
