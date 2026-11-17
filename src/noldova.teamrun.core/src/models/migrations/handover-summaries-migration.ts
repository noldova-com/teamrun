/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";

import { Resources } from "../../resources.js";

export class HandoverSummariesMigration extends SqlMigration {
  public constructor() {
    super(Resources.handoverSummariesMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.createTable<{ readonly chatId: string; readonly teammateId: string; readonly through: number; readonly text: string }>(
      Resources.handoverSummariesTable,
      table => {
        table.addColumn(t => t.chatId, ColumnType.Text);
        table.addColumn(t => t.teammateId, ColumnType.Text);
        table.addColumn(t => t.through, ColumnType.Integer);
        table.addColumn(t => t.text, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.chatId, t => t.teammateId)
        .addForeignKey<{ readonly id: string }>(t => t.chatId, Resources.conversationsTable, t => t.id));
  }
}
