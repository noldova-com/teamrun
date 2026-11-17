/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";

import { Resources } from "../../resources.js";

export class ReadingPositionsMigration extends SqlMigration {
  public constructor() {
    super(Resources.readingPositionsMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.createTable<{ readonly conversationId: string; readonly updatedAt: string }>(Resources.readingPositionsTable,
      table => {
        table.addColumn(t => t.conversationId, ColumnType.Text);
        table.addColumn(Resources.jsonColumn, ColumnType.Text);
        table.addColumn(t => t.updatedAt, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.conversationId)
        .addForeignKey<{ readonly id: string }>(t => t.conversationId, Resources.legacyConversationsTable, t => t.id));
  }
}
