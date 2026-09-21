/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ColumnsBuilder, ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/teamrun-foundation-data-sql";
import type { Approval, Conversation, Message, Project, ProviderAccount } from "@noldova/teamrun-protocol";

import { Resources } from "../resources.js";

export class InitialMigration extends SqlMigration {
  public constructor() {
    super(Resources.initialMigrationId);
  }

  public override up(builder: MigrationBuilder): void {
    builder.createTable<Project>(Resources.projectsTable,
      table => {
        table.column(t => t.id, ColumnType.Text);
        table.column(t => t.rootPath, ColumnType.Text);
        InitialMigration.addRecordColumns(table);
      },
      constraints => constraints.primaryKey(t => t.id));
    builder.createUniqueIndex<Project>(Resources.projectsTable, t => t.rootPath);
    builder.createTable<Conversation>(Resources.conversationsTable,
      table => {
        table.column(t => t.id, ColumnType.Text);
        table.column(t => t.projectId, ColumnType.Text);
        InitialMigration.addRecordColumns(table);
      },
      constraints => constraints.primaryKey(t => t.id).foreignKey<Project>(t => t.projectId, Resources.projectsTable, t => t.id));
    builder.createIndex<Conversation>(Resources.conversationsTable, t => t.projectId);
    builder.createTable<Message>(Resources.messagesTable,
      table => {
        table.column(t => t.id, ColumnType.Text);
        table.column(t => t.conversationId, ColumnType.Text);
        table.column(t => t.sequence, ColumnType.Integer);
        table.column(t => t.status, ColumnType.Text);
        InitialMigration.addRecordColumns(table);
      },
      constraints => constraints.primaryKey(t => t.id).foreignKey<Conversation>(t => t.conversationId, Resources.conversationsTable, t => t.id));
    builder.createUniqueIndex<Message>(Resources.messagesTable, t => t.conversationId, t => t.sequence);
    builder.createIndex<Message>(Resources.messagesTable, t => t.conversationId, t => t.status);
    builder.createTable<Approval>(Resources.approvalsTable,
      table => {
        table.column(t => t.id, ColumnType.Text);
        table.column(t => t.messageId, ColumnType.Text);
        table.column(t => t.status, ColumnType.Text);
        InitialMigration.addRecordColumns(table);
      },
      constraints => constraints.primaryKey(t => t.id).foreignKey<Message>(t => t.messageId, Resources.messagesTable, t => t.id));
    builder.createIndex<Approval>(Resources.approvalsTable, t => t.messageId, t => t.status);
    builder.createTable<ProviderAccount>(Resources.providerAccountsTable,
      table => {
        table.column(t => t.id, ColumnType.Text);
        table.column(t => t.provider, ColumnType.Text);
        InitialMigration.addRecordColumns(table);
      },
      constraints => constraints.primaryKey(t => t.id));
    builder.createIndex<ProviderAccount>(Resources.providerAccountsTable, t => t.provider);
  }

  private static addRecordColumns<TModel extends { readonly createdAt: string }>(table: ColumnsBuilder<TModel>): void {
    table.column(Resources.jsonColumn, ColumnType.Text);
    table.column(t => t.createdAt, ColumnType.Text);
    table.column(Resources.updatedAtColumn, ColumnType.Text);
  }
}
