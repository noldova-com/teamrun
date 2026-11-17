/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeOperation } from "@noldova/context.data";
import { MigrationBuilder, SqlQuery } from "@noldova/context.data.sql";
import { SQLiteDialect } from "@noldova/context.data.sql.sqlite";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChatNamesMigration, ConversationsService, DatabaseContext, MigrationCatalog, ReadingPositionsService, Resources } from "@noldova/teamrun.core";
import {
  Chat,
  ChatMember,
  ChatPosition,
  DetailKind,
  Draft,
  Harness,
  Message,
  MessageAuthor,
  MessageDetail,
  MessageSender,
  MessageStatus,
  ObservedSettings,
  Project,
  Provenance,
  RequestedSettings,
  Teammate
} from "@noldova/teamrun.protocol";

import { LegacyDatabaseContext } from "../../fixtures/legacy-database-context.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

type JsonRecord = Record<string, unknown>;

@TestClass
export class ChatNamesMigrationTests {
  private static readonly toolPayload: JsonRecord = { conversationId: "theirs", input: { conversationId: "theirs" } };
  private static readonly approvalPayload: JsonRecord = { conversationId: "theirs", input: { conversationId: "theirs" } };

  @TestMethod
  public renamesTheTablesColumnsIndexesEntitiesAndEachKnownFieldUnderItsOwnId(): void {
    const migration = new ChatNamesMigration();
    Assert.areEqual("20261025210000_ChatNames", migration.id);
    Assert.isTrue(Resources.chatNamesMigrationId > Resources.chatTitlesMigrationId);
    const builder = new MigrationBuilder();
    migration.apply(builder);

    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));

    Assert.areEqual(17 + 2 * Resources.renamedChatFields.length + Resources.chatIdRowTables.length, statements.length);
    Assert.areEqual([
      "ALTER TABLE conversations RENAME TO chats",
      "ALTER TABLE conversationTeammates RENAME TO chatTeammates",
      "ALTER TABLE messages RENAME COLUMN conversationId TO chatId",
      "ALTER TABLE drafts RENAME COLUMN conversationId TO chatId",
      "ALTER TABLE readingPositions RENAME COLUMN conversationId TO chatId",
      "ALTER TABLE chatTeammates RENAME COLUMN conversationId TO chatId",
      "DROP INDEX IX_conversations_projectId",
      "DROP INDEX IX_messages_conversationId_sequence",
      "DROP INDEX IX_messages_conversationId_status",
      "DROP INDEX IX_conversationTeammates_teammateId",
      "CREATE INDEX \"IX_chats_projectId\" ON \"chats\" (\"projectId\")",
      "CREATE UNIQUE INDEX \"IX_messages_chatId_sequence\" ON \"messages\" (\"chatId\", \"sequence\")",
      "CREATE INDEX \"IX_messages_chatId_status\" ON \"messages\" (\"chatId\", \"status\")",
      "CREATE INDEX \"IX_chatTeammates_teammateId\" ON \"chatTeammates\" (\"teammateId\")",
      Resources.createChangesTable,
      "UPDATE __changes SET entity = 'Chat' WHERE entity = 'Conversation'",
      "UPDATE __changes SET entity = 'ChatMember' WHERE entity = 'ConversationMember'"
    ].join("\n"), statements.slice(0, 17).join("\n"));
    Assert.areEqual("UPDATE messages SET json = json_remove(json_insert(json, '$.sender.chatId', json_extract(json, '$.sender.conversationId')), "
      + "'$.sender.conversationId') WHERE json_type(json, '$.sender.conversationId') IS NOT NULL", statements[19]);
    Assert.areEqual("UPDATE __changes SET payload = json_remove(json_insert(payload, '$.chatId', json_extract(payload, '$.conversationId')), "
      + "'$.conversationId') WHERE entity = 'ChatMember' AND json_type(payload, '$.conversationId') IS NOT NULL", statements[22]);
    Assert.areEqual("UPDATE readingPositions SET json = json_remove(json_insert(json, '$.chatId', json_extract(json, '$.conversationId')), "
      + "'$.conversationId') WHERE json_type(json, '$.conversationId') IS NOT NULL", statements.at(-1));
  }

  @TestMethod
  public async keepsEveryChatMessageMemberDraftPositionAndChangeOfADatabaseFromBeforeIt(): Promise<void> {
    const project = new Project("pr1", "Work", "/work", "t");
    const teammate = new Teammate("t1", "Alice", null, "p1", Harness.Provider, "opus", "high", "t", "t");
    const chat = new Chat("c1", "pr1", "Plans", "t", "t", false, null, null);
    const requested = new RequestedSettings("claude", "opus", null);
    const sent = new Message("m1", "c1", 1, MessageAuthor.User, null, MessageStatus.Completed, [new MessageDetail(1, DetailKind.Text, "Hi", null, "t")], null,
      "t", null, "t", [], null, null, [], new MessageSender("c2", "t1", "Alice"));
    const reply = new Message("m2", "c1", 2, MessageAuthor.Provider, "m1", MessageStatus.Completed,
      [new MessageDetail(1, DetailKind.Text, "Done", ChatNamesMigrationTests.toolPayload as never, "t")],
      new Provenance("p1", requested, new ObservedSettings("claude", "opus", null, "2.1"), "s1", false), "t", "t", "t");
    const member = new ChatMember("c1", "t1", "t", "s1", false);
    const draft = new Draft("c1", "Keep me", [], [], 3, "t");
    const position = new ChatPosition("c1", "m1", 1, 0);
    using directory = new TemporaryDataDirectory();
    {
      const before = MigrationCatalog.all.slice(0, MigrationCatalog.all.findIndex(t => t instanceof ChatNamesMigration));
      await using legacy = await LegacyDatabaseContext.openAsync(directory.path, before);
      const execute = async (statement: string, parameters: readonly (string | number)[]): Promise<number> => legacy.database.connection.executeAsync(new SqlQuery(statement, parameters));
      await execute("INSERT INTO projects (id, rootPath, json, createdAt, updatedAt) VALUES (?, ?, ?, 't', 't')", [project.id, project.rootPath, JSON.stringify(project.toJson())]);
      await execute("INSERT INTO teammates (id, name, json, createdAt, updatedAt) VALUES (?, ?, ?, 't', 't')", [teammate.id, "alice", JSON.stringify(teammate.toJson())]);
      await execute("INSERT INTO conversations (id, projectId, json, createdAt, updatedAt) VALUES (?, ?, ?, 't', 't')", [chat.id, project.id, JSON.stringify(chat.toJson())]);
      for (const message of [sent, reply])
        await execute("INSERT INTO messages (id, conversationId, sequence, status, json, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 't', 't')",
          [message.id, chat.id, message.sequence, message.status, JSON.stringify(ChatNamesMigrationTests.oldMessage(message))]);
      await execute("INSERT INTO conversationTeammates (conversationId, teammateId, json, joinedAt) VALUES (?, ?, ?, 't')",
        [chat.id, teammate.id, JSON.stringify(ChatNamesMigrationTests.old(member))]);
      await execute("INSERT INTO drafts (conversationId, json, revision, updatedAt) VALUES (?, ?, 3, 't')", [chat.id, JSON.stringify(ChatNamesMigrationTests.old(draft))]);
      await execute("INSERT INTO readingPositions (conversationId, json, updatedAt) VALUES (?, ?, 't')", [chat.id, JSON.stringify(ChatNamesMigrationTests.old(position))]);
      await legacy.database.changeFeed.appendAsync("Conversation", chat.id, ChangeOperation.Insert, JSON.stringify(chat.toJson()));
      await legacy.database.changeFeed.appendAsync("ConversationMember", "c1:t1", ChangeOperation.Insert, JSON.stringify(ChatNamesMigrationTests.old(member)));
      await legacy.database.changeFeed.appendAsync("Message", sent.id, ChangeOperation.Update, JSON.stringify(ChatNamesMigrationTests.oldMessage(sent)));
      await legacy.database.changeFeed.appendAsync("Approval", "a1", ChangeOperation.Insert, JSON.stringify(ChatNamesMigrationTests.approvalPayload));
    }
    await using current = await DatabaseContext.openAsync(directory.path);
    const connection = current.database.connection;
    const names = async (statement: string): Promise<string> => (await connection.queryAsync(new SqlQuery(statement))).map(t => t.readString("name")).join(",");
    const json = async (statement: string): Promise<string> => (await connection.queryAsync(new SqlQuery(statement))).map(t => t.readString("json")).join("\n");

    Assert.areEqual(MigrationCatalog.all.length, (await current.database.getAppliedMigrationsAsync()).length);
    Assert.areEqual("chatTeammates,chatWakes,chats", await names("SELECT name FROM sqlite_master WHERE type = 'table' AND (name LIKE '%hat%' OR name LIKE '%onversation%') ORDER BY name"));
    Assert.areEqual("chatId,chatId,chatId,chatId", (await Promise.all(["messages", "drafts", "readingPositions", "chatTeammates"]
      .map(t => names(`SELECT name FROM pragma_table_info('${t}') WHERE name IN ('chatId', 'conversationId')`)))).join(","));
    Assert.areEqual("IX_backgroundTasks_chatId,IX_chatTeammates_teammateId,IX_chatWakes_state,IX_chats_projectId,IX_messages_chatId_sequence,IX_messages_chatId_status,IX_runOutputs_chatId,IX_sustainAttempts_chatId,IX_waitingMessages_chatId",
      await names("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'IX_%' AND (name LIKE '%hat%' OR name LIKE '%onversation%') ORDER BY name"));
    Assert.areEqual("CREATE UNIQUE INDEX \"IX_messages_chatId_sequence\" ON \"messages\" (\"chatId\", \"sequence\")",
      (await connection.queryAsync(new SqlQuery("SELECT sql FROM sqlite_master WHERE name = 'IX_messages_chatId_sequence'")))[0]?.readString("sql"));
    Assert.areEqual(0, (await connection.queryAsync(new SqlQuery("PRAGMA foreign_key_check"))).length);
    await Assert.throwsAsync(() => connection.executeAsync(new SqlQuery("INSERT INTO drafts (chatId, json, revision, updatedAt) VALUES ('missing', '{}', 1, 't')")), Error);
    Assert.areEqual(JSON.stringify(chat.toJson()), ChatNamesMigrationTests.read(await json("SELECT json FROM chats"), Chat));
    Assert.areEqual([sent, reply].map(t => JSON.stringify(t.toJson())).join("\n"),
      (await json("SELECT json FROM messages ORDER BY sequence")).split("\n").map(t => ChatNamesMigrationTests.read(t, Message)).join("\n"));
    Assert.areEqual(JSON.stringify(ChatNamesMigrationTests.toolPayload),
      JSON.stringify((JSON.parse(await json("SELECT json FROM messages WHERE id = 'm2'")) as { details: { payload: unknown }[] }).details[0]?.payload));
    Assert.areEqual(JSON.stringify(member.toJson()), ChatNamesMigrationTests.read(await json("SELECT json FROM chatTeammates"), ChatMember));
    Assert.areEqual(JSON.stringify(draft.toJson()), ChatNamesMigrationTests.read(await json("SELECT json FROM drafts"), Draft));
    Assert.areEqual(JSON.stringify(position.toJson()), ChatNamesMigrationTests.read(await json("SELECT json FROM readingPositions"), ChatPosition));
    Assert.areEqual("Plans", (await new ConversationsService(current).findAsync(chat.id))?.title);
    Assert.areEqual(JSON.stringify([position.toJson()]), JSON.stringify((await new ReadingPositionsService(current).listAsync()).map(t => t.toJson())));
    const changes = await current.database.changeFeed.readAfterAsync(0);
    Assert.areEqual("Chat,ChatMember,Message,Approval", changes.map(t => t.entity).join(","));
    Assert.areEqual(JSON.stringify(chat.toJson()), ChatNamesMigrationTests.read(changes[0]?.payload ?? "", Chat));
    Assert.areEqual(JSON.stringify(member.toJson()), ChatNamesMigrationTests.read(changes[1]?.payload ?? "", ChatMember));
    Assert.areEqual(JSON.stringify(sent.toJson()), ChatNamesMigrationTests.read(changes[2]?.payload ?? "", Message));
    Assert.areEqual(JSON.stringify(ChatNamesMigrationTests.approvalPayload), changes[3]?.payload);
  }

  private static read(json: string, model: { fromJson(value: unknown): { toJson(): unknown } }): string {
    return JSON.stringify(model.fromJson(JSON.parse(json)).toJson());
  }

  private static oldMessage(message: Message): JsonRecord {
    const json = ChatNamesMigrationTests.old(message);
    return Object.isNull(message.sender) ? json : { ...json, sender: ChatNamesMigrationTests.old(message.sender) };
  }

  private static old(model: { toJson(): unknown }): JsonRecord {
    return Object.fromEntries(Object.entries(model.toJson() as JsonRecord).map(([key, item]) => [key === "chatId" ? "conversationId" : key, item]));
  }
}
