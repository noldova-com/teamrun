/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";
import type { Teammate } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";

export class TeammatesMigration extends SqlMigration {
  public constructor() {
    super(Resources.teammatesMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.createTable<Teammate>(Resources.teammatesTable,
      table => {
        table.addColumn(t => t.id, ColumnType.Text);
        table.addColumn(t => t.name, ColumnType.Text);
        table.addColumn(Resources.jsonColumn, ColumnType.Text);
        table.addColumn(t => t.createdAt, ColumnType.Text);
        table.addColumn(t => t.updatedAt, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.id));
    builder.createUniqueIndex<Teammate>(Resources.teammatesTable, t => t.name);
    builder.createTable<{ readonly conversationId: string; readonly teammateId: string; readonly joinedAt: string }>(Resources.legacyConversationTeammatesTable,
      table => {
        table.addColumn(t => t.conversationId, ColumnType.Text);
        table.addColumn(t => t.teammateId, ColumnType.Text);
        table.addColumn(Resources.jsonColumn, ColumnType.Text);
        table.addColumn(t => t.joinedAt, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.conversationId, t => t.teammateId)
        .addForeignKey<{ readonly id: string }>(t => t.conversationId, Resources.legacyConversationsTable, t => t.id)
        .addForeignKey<Teammate>(t => t.teammateId, Resources.teammatesTable, t => t.id));
    builder.createIndex<{ readonly teammateId: string }>(Resources.legacyConversationTeammatesTable, t => t.teammateId);
  }
}
