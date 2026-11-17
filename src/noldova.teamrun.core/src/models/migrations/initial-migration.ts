/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ColumnsBuilder, ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";
import type { Approval, Message, Project } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";

export class InitialMigration extends SqlMigration {
  public constructor() {
    super(Resources.initialMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.createTable<Project>(Resources.projectsTable,
      table => {
        table.addColumn(t => t.id, ColumnType.Text);
        table.addColumn(t => t.rootPath, ColumnType.Text);
        InitialMigration.addRecordColumns(table);
      },
      constraints => constraints.addPrimaryKey(t => t.id));
    builder.createUniqueIndex<Project>(Resources.projectsTable, t => t.rootPath);
    builder.createTable<{ readonly id: string; readonly projectId: string; readonly createdAt: string }>(Resources.legacyConversationsTable,
      table => {
        table.addColumn(t => t.id, ColumnType.Text);
        table.addColumn(t => t.projectId, ColumnType.Text);
        InitialMigration.addRecordColumns(table);
      },
      constraints => constraints.addPrimaryKey(t => t.id).addForeignKey<Project>(t => t.projectId, Resources.projectsTable, t => t.id));
    builder.createIndex<{ readonly projectId: string }>(Resources.legacyConversationsTable, t => t.projectId);
    builder.createTable<{ readonly id: string; readonly conversationId: string; readonly sequence: number; readonly status: string; readonly createdAt: string }>(Resources.messagesTable,
      table => {
        table.addColumn(t => t.id, ColumnType.Text);
        table.addColumn(t => t.conversationId, ColumnType.Text);
        table.addColumn(t => t.sequence, ColumnType.Integer);
        table.addColumn(t => t.status, ColumnType.Text);
        InitialMigration.addRecordColumns(table);
      },
      constraints => constraints.addPrimaryKey(t => t.id).addForeignKey<{ readonly id: string }>(t => t.conversationId,
        Resources.legacyConversationsTable, t => t.id));
    builder.createUniqueIndex<{ readonly conversationId: string; readonly sequence: number }>(Resources.messagesTable, t => t.conversationId, t => t.sequence);
    builder.createIndex<{ readonly conversationId: string; readonly status: string }>(Resources.messagesTable, t => t.conversationId, t => t.status);
    builder.createTable<Approval>(Resources.approvalsTable,
      table => {
        table.addColumn(t => t.id, ColumnType.Text);
        table.addColumn(t => t.messageId, ColumnType.Text);
        table.addColumn(t => t.status, ColumnType.Text);
        InitialMigration.addRecordColumns(table);
      },
      constraints => constraints.addPrimaryKey(t => t.id).addForeignKey<Message>(t => t.messageId, Resources.messagesTable, t => t.id));
    builder.createIndex<Approval>(Resources.approvalsTable, t => t.messageId, t => t.status);
    builder.createTable<{ readonly id: string; readonly provider: string; readonly createdAt: string }>(Resources.legacyProvidersTable,
      table => {
        table.addColumn(t => t.id, ColumnType.Text);
        table.addColumn(t => t.provider, ColumnType.Text);
        InitialMigration.addRecordColumns(table);
      },
      constraints => constraints.addPrimaryKey(t => t.id));
    builder.createIndex<{ readonly provider: string }>(Resources.legacyProvidersTable, t => t.provider);
  }

  private static addRecordColumns<TModel extends { readonly createdAt: string }>(table: ColumnsBuilder<TModel>): void {
    table.addColumn(Resources.jsonColumn, ColumnType.Text);
    table.addColumn(t => t.createdAt, ColumnType.Text);
    table.addColumn(Resources.updatedAtColumn, ColumnType.Text);
  }
}
