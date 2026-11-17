/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";

import { Resources } from "../../resources.js";

export class SustainAttemptsMigration extends SqlMigration {
  public constructor() {
    super(Resources.sustainAttemptsMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.createTable<{ readonly chainId: string; readonly teammateId: string; readonly providerId: string; readonly chatId: string }>(
      Resources.sustainAttemptsTable,
      table => {
        table.addColumn(t => t.chainId, ColumnType.Text);
        table.addColumn(t => t.teammateId, ColumnType.Text);
        table.addColumn(t => t.providerId, ColumnType.Text);
        table.addColumn(t => t.chatId, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.chainId, t => t.teammateId, t => t.providerId)
        .addForeignKey<{ readonly id: string }>(t => t.chatId, Resources.conversationsTable, t => t.id));
    builder.createIndex<{ readonly chatId: string }>(Resources.sustainAttemptsTable, t => t.chatId);
  }
}
