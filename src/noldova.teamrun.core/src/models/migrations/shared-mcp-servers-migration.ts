/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";

import { Resources } from "../../resources.js";

export class SharedMcpServersMigration extends SqlMigration {
  public constructor() {
    super(Resources.sharedMcpServersMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.createTable<{ readonly id: string; readonly name: string; readonly createdAt: string; readonly updatedAt: string }>(Resources.sharedMcpServersTable,
      table => {
        table.addColumn(t => t.id, ColumnType.Text);
        table.addColumn(t => t.name, ColumnType.Text);
        table.addColumn(Resources.jsonColumn, ColumnType.Text);
        table.addColumn(t => t.createdAt, ColumnType.Text);
        table.addColumn(t => t.updatedAt, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.id));
    builder.createUniqueIndex<{ readonly name: string }>(Resources.sharedMcpServersTable, t => t.name);
  }
}
