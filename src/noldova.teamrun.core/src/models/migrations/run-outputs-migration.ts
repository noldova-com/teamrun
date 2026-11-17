/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";

import { Resources } from "../../resources.js";


export class RunOutputsMigration extends SqlMigration {
  public constructor() {
    super(Resources.runOutputsMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.createTable<{ readonly chatId: string; readonly messageId: string; readonly site: string; readonly block: number; readonly updatedAt: string }>(
      Resources.runOutputsTable,
      table => {
        table.addColumn(t => t.chatId, ColumnType.Text);
        table.addColumn(t => t.messageId, ColumnType.Text);
        table.addColumn(t => t.site, ColumnType.Text);
        table.addColumn(t => t.block, ColumnType.Integer);
        table.addColumn(Resources.jsonColumn, ColumnType.Text);
        table.addColumn(t => t.updatedAt, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.messageId, t => t.site, t => t.block)
        .addForeignKey<{ readonly id: string }>(t => t.chatId, Resources.conversationsTable, t => t.id));
    builder.createIndex<{ readonly chatId: string }>(Resources.runOutputsTable, t => t.chatId);
  }
}
