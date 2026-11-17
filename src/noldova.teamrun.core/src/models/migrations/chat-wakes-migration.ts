/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";

import { Resources } from "../../resources.js";

export class ChatWakesMigration extends SqlMigration {
  public constructor() {
    super(Resources.chatWakesMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.createTable<{ readonly id: string; readonly chatId: string; readonly state: string; readonly updatedAt: string }>(Resources.chatWakesTable,
      table => {
        table.addColumn(t => t.id, ColumnType.Text);
        table.addColumn(t => t.chatId, ColumnType.Text);
        table.addColumn(t => t.state, ColumnType.Text);
        table.addColumn(Resources.jsonColumn, ColumnType.Text);
        table.addColumn(t => t.updatedAt, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.id)
        .addForeignKey<{ readonly id: string }>(t => t.chatId, Resources.conversationsTable, t => t.id));
    builder.createIndex<{ readonly state: string }>(Resources.chatWakesTable, t => t.state);
  }
}
