/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";

import { Resources } from "../../resources.js";

export class DraftsMigration extends SqlMigration {
  public constructor() {
    super(Resources.draftsMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.createTable<{ readonly conversationId: string; readonly revision: number; readonly updatedAt: string }>(Resources.draftsTable,
      table => {
        table.addColumn(t => t.conversationId, ColumnType.Text);
        table.addColumn(Resources.jsonColumn, ColumnType.Text).makeNullable();
        table.addColumn(t => t.revision, ColumnType.Integer);
        table.addColumn(t => t.updatedAt, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.conversationId)
        .addForeignKey<{ readonly id: string }>(t => t.conversationId, Resources.legacyConversationsTable, t => t.id));
  }
}
