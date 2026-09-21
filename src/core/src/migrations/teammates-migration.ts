/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/teamrun-foundation-data-sql";
import type { Conversation, ConversationMember, Teammate } from "@noldova/teamrun-protocol";

import { Resources } from "../resources.js";

export class TeammatesMigration extends SqlMigration {
  public constructor() {
    super(Resources.teammatesMigrationId);
  }

  public override up(builder: MigrationBuilder): void {
    builder.createTable<Teammate>(Resources.teammatesTable,
      table => {
        table.column(t => t.id, ColumnType.Text);
        table.column(t => t.name, ColumnType.Text);
        table.column(Resources.jsonColumn, ColumnType.Text);
        table.column(t => t.createdAt, ColumnType.Text);
        table.column(t => t.updatedAt, ColumnType.Text);
      },
      constraints => constraints.primaryKey(t => t.id));
    builder.createUniqueIndex<Teammate>(Resources.teammatesTable, t => t.name);
    builder.createTable<ConversationMember>(Resources.conversationTeammatesTable,
      table => {
        table.column(t => t.conversationId, ColumnType.Text);
        table.column(t => t.teammateId, ColumnType.Text);
        table.column(Resources.jsonColumn, ColumnType.Text);
        table.column(t => t.joinedAt, ColumnType.Text);
      },
      constraints => constraints.primaryKey(t => t.conversationId, t => t.teammateId)
        .foreignKey<Conversation>(t => t.conversationId, Resources.conversationsTable, t => t.id)
        .foreignKey<Teammate>(t => t.teammateId, Resources.teammatesTable, t => t.id));
    builder.createIndex<ConversationMember>(Resources.conversationTeammatesTable, t => t.teammateId);
  }
}
