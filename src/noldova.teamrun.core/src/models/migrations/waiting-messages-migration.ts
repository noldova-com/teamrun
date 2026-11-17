/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";

import { Resources } from "../../resources.js";

export class WaitingMessagesMigration extends SqlMigration {
  public constructor() {
    super(Resources.waitingMessagesMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.createTable<{ readonly id: string; readonly chatId: string; readonly updatedAt: string }>(Resources.waitingMessagesTable,
      table => {
        table.addColumn(t => t.id, ColumnType.Text);
        table.addColumn(t => t.chatId, ColumnType.Text);
        table.addColumn(Resources.jsonColumn, ColumnType.Text);
        table.addColumn(t => t.updatedAt, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.id)
        .addForeignKey<{ readonly id: string }>(t => t.chatId, Resources.conversationsTable, t => t.id));
    builder.createIndex<{ readonly chatId: string }>(Resources.waitingMessagesTable, t => t.chatId);
  }
}
