/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";
import type { Chat, ChatMember, Message } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";

export class ChatNamesMigration extends SqlMigration {
  public constructor() {
    super(Resources.chatNamesMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    for (const statement of [...Resources.renameChatTables, ...Resources.renameChatIdColumns, ...Resources.dropLegacyChatIndexes])
      builder.executeSql(statement);
    builder.createIndex<Chat>(Resources.conversationsTable, t => t.projectId);
    builder.createUniqueIndex<Message>(Resources.messagesTable, t => t.chatId, t => t.sequence);
    builder.createIndex<Message>(Resources.messagesTable, t => t.chatId, t => t.status);
    builder.createIndex<ChatMember>(Resources.conversationTeammatesTable, t => t.teammateId);
    builder.executeSql(Resources.createChangesTable);
    for (const statement of Resources.renameChatEntities)
      builder.executeSql(statement);
    for (const field of Resources.renamedChatFields) {
      builder.executeSql(Resources.formatRenameJsonField(field.table, Resources.jsonColumn, field.from, field.to, {}));
      builder.executeSql(Resources.formatRenameJsonField(Resources.changesTable, Resources.payloadColumn, field.from, field.to,
        { [Resources.entityColumn]: field.entity }));
    }
    for (const table of Resources.chatIdRowTables)
      builder.executeSql(Resources.formatRenameJsonField(table, Resources.jsonColumn, Resources.legacyChatIdPath, Resources.chatIdPath, {}));
  }
}
