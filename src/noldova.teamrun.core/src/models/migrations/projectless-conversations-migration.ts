/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";
import type { Project } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";

export class ProjectlessConversationsMigration extends SqlMigration {
  public constructor() {
    super(Resources.projectlessConversationsMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.executeSql(Resources.deferForeignKeys);
    builder.executeSql(Resources.copyConversations);
    builder.executeSql(Resources.dropConversations);
    builder.createTable<{ readonly id: string; readonly projectId: string | null; readonly createdAt: string }>(Resources.legacyConversationsTable,
      table => {
        table.addColumn(t => t.id, ColumnType.Text);
        table.addColumn(t => t.projectId, ColumnType.Text).makeNullable();
        table.addColumn(Resources.jsonColumn, ColumnType.Text);
        table.addColumn(t => t.createdAt, ColumnType.Text);
        table.addColumn(Resources.updatedAtColumn, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.id).addForeignKey<Project>(t => t.projectId, Resources.projectsTable, t => t.id));
    builder.createIndex<{ readonly projectId: string | null }>(Resources.legacyConversationsTable, t => t.projectId);
    builder.executeSql(Resources.restoreConversations);
    builder.executeSql(Resources.dropConversationsCopy);
  }
}
