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
import { ChatTitlesMigration, ConversationsService, MigrationCatalog, Resources } from "@noldova/teamrun.core";
import {
  Conversation,
  ConversationMemberParams,
  ConversationMoveParams,
  ConversationResponder,
  ConversationResponderParams,
  Harness,
  Project,
  Teammate
} from "@noldova/teamrun.protocol";

import { LegacyDatabaseContext } from "../../fixtures/legacy-database-context.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";
import { TestDatabase } from "../../fixtures/test-database.fixture.js";

type JsonRecord = Record<string, unknown>;

@TestClass
export class ChatTitlesMigrationTests {
  private static readonly created: string = "2026-10-01T09:00:00.000Z";
  private static readonly updated: string = "2026-10-02T10:00:00.000Z";

  @TestMethod
  public renamesTheEarlierDefaultTitleInTheChatsAndTheChangeFeed(): void {
    const migration = new ChatTitlesMigration();
    Assert.areEqual("20261025200000_ChatTitles", migration.id);
    const builder = new MigrationBuilder();
    migration.apply(builder);

    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));

    Assert.areEqual([Resources.renameDefaultChatTitles, Resources.renameDefaultChatTitlesInChanges].join("\n"), statements.join("\n"));
  }

  @TestMethod
  public async namesEveryChatStillCalledNewConversationNewChatEditedOrNotAndKeepsItsTimeAndEveryOtherTitle(): Promise<void> {
    const project = new Project("pr1", "Work", "/work", "t");
    const unnamed = ChatTitlesMigrationTests.chat("c1", "New conversation", false);
    const named = ChatTitlesMigrationTests.chat("c2", "New conversation", true);
    const titled = ChatTitlesMigrationTests.chat("c3", "Plans", false);
    const older = Object.fromEntries(Object.entries(ChatTitlesMigrationTests.chat("c4", "New conversation", false)).filter(([key]) => key !== "edited"));
    using directory = new TemporaryDataDirectory();
    {
      const before = MigrationCatalog.all.slice(0, MigrationCatalog.all.findIndex(t => t instanceof ChatTitlesMigration));
      await using legacy = await LegacyDatabaseContext.openAsync(directory.path, before);
      const execute = async (statement: string, parameters: readonly (string | number)[]): Promise<number> => legacy.database.connection.executeAsync(new SqlQuery(statement, parameters));
      await execute("INSERT INTO projects (id, rootPath, json, createdAt, updatedAt) VALUES (?, ?, ?, 't', 't')", [project.id, project.rootPath, JSON.stringify(project.toJson())]);
      for (const chat of [unnamed, named, titled, older])
        await execute("INSERT INTO conversations (id, projectId, json, createdAt, updatedAt) VALUES (?, 'pr1', ?, ?, ?)",
          [chat["id"] as string, JSON.stringify(chat), ChatTitlesMigrationTests.created, ChatTitlesMigrationTests.updated]);
      await legacy.database.changeFeed.appendAsync("Conversation", "c1", ChangeOperation.Insert, JSON.stringify(unnamed));
      await legacy.database.changeFeed.appendAsync("Conversation", "c2", ChangeOperation.Update, JSON.stringify(named));
      await legacy.database.changeFeed.appendAsync("Conversation", "c4", ChangeOperation.Delete, JSON.stringify(older));
      await legacy.database.changeFeed.appendAsync("Message", "m1", ChangeOperation.Insert, JSON.stringify({ title: "New conversation" }));
    }
    await using current = await TestDatabase.openAsync(directory.path);
    const rows = await current.database.connection.queryAsync(new SqlQuery("SELECT id, json, updatedAt FROM chats ORDER BY id"));
    const chats = rows.map(t => Conversation.fromJson(JSON.parse(t.readString("json"))));
    const changes = await current.database.changeFeed.readAfterAsync(0);

    Assert.areEqual(MigrationCatalog.all.length, (await current.database.getAppliedMigrationsAsync()).length);
    Assert.areEqual("New chat,New chat,Plans,New chat", chats.map(t => t.title).join(","));
    Assert.areEqual("false,true,false,false", chats.map(t => String(t.edited)).join(","));
    Assert.areEqual(ChatTitlesMigrationTests.updated, [...new Set([...rows.map(t => t.readString("updatedAt")), ...chats.map(t => t.updatedAt)])].join(","));
    Assert.areEqual("New chat,New chat,New chat", changes.filter(t => t.entity === "Chat")
      .map(t => (JSON.parse(t.payload) as JsonRecord)["title"]).join(","));
    Assert.areEqual(JSON.stringify({ title: "New conversation" }), changes.find(t => t.entity === "Message")?.payload);
  }

  @TestMethod
  public async namesAChatNewChatWhenAChosenResponderATeammateOrAMoveMarkedItEdited(): Promise<void> {
    const ids = ["c1", "c2", "c3"];
    const projects = [new Project("pr1", "Work", "/work", "t"), new Project("pr2", "Home", "/home", "t")];
    using edits = new TemporaryDataDirectory();
    using directory = new TemporaryDataDirectory();
    {
      await using earlier = await TestDatabase.openAsync(edits.path);
      const execute = async (statement: string, parameters: readonly (string | number)[]): Promise<number> => earlier.database.connection.executeAsync(new SqlQuery(statement, parameters));
      for (const project of projects)
        await execute("INSERT INTO projects (id, rootPath, json, createdAt, updatedAt) VALUES (?, ?, ?, 't', 't')", [project.id, project.rootPath, JSON.stringify(project.toJson())]);
      const teammate = new Teammate("t1", "Alice", null, "p1", Harness.Provider, "opus", "high", "t", "t");
      await execute("INSERT INTO teammates (id, name, json, createdAt, updatedAt) VALUES (?, ?, ?, 't', 't')", [teammate.id, "alice", JSON.stringify(teammate.toJson())]);
      for (const id of ids)
        await execute("INSERT INTO chats (id, projectId, json, createdAt, updatedAt) VALUES (?, 'pr1', ?, ?, ?)",
          [id, JSON.stringify(ChatTitlesMigrationTests.chat(id, "New conversation", false)), ChatTitlesMigrationTests.created, ChatTitlesMigrationTests.updated]);
      const service = new ConversationsService(earlier);
      await service.setResponderAsync(new ConversationResponderParams("c1", new ConversationResponder("t1"), true));
      await service.addMemberAsync(new ConversationMemberParams("c2", "t1"));
      await service.moveAsync(new ConversationMoveParams("c3", "pr2"));
      Assert.areEqual("true,true,true", (await Promise.all(ids.map(async t => String((await service.findAsync(t))?.edited)))).join(","));
      const rows = await earlier.database.connection.queryAsync(new SqlQuery("SELECT id, projectId, json FROM chats ORDER BY id"));
      const edited = (await earlier.database.changeFeed.readAfterAsync(0)).filter(t => t.entity === "Chat");
      const before = MigrationCatalog.all.slice(0, MigrationCatalog.all.findIndex(t => t instanceof ChatTitlesMigration));
      await using legacy = await LegacyDatabaseContext.openAsync(directory.path, before);
      const insert = async (statement: string, parameters: readonly (string | number)[]): Promise<number> => legacy.database.connection.executeAsync(new SqlQuery(statement, parameters));
      for (const project of projects)
        await insert("INSERT INTO projects (id, rootPath, json, createdAt, updatedAt) VALUES (?, ?, ?, 't', 't')", [project.id, project.rootPath, JSON.stringify(project.toJson())]);
      for (const row of rows)
        await insert("INSERT INTO conversations (id, projectId, json, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
          [row.readString("id"), row.readString("projectId"), row.readString("json"), ChatTitlesMigrationTests.created, ChatTitlesMigrationTests.updated]);
      for (const change of edited)
        await legacy.database.changeFeed.appendAsync("Conversation", change.entityId, change.operation, change.payload);
    }
    await using current = await TestDatabase.openAsync(directory.path);
    const titles = (await current.database.connection.queryAsync(new SqlQuery("SELECT json FROM chats ORDER BY id")))
      .map(t => Conversation.fromJson(JSON.parse(t.readString("json"))).title);
    const changes = (await current.database.changeFeed.readAfterAsync(0)).filter(t => t.entity === "Chat");

    Assert.areEqual("New chat,New chat,New chat", titles.join(","));
    Assert.areEqual("c1,c2,c3", changes.map(t => t.entityId).join(","));
    Assert.areEqual("New chat,New chat,New chat", changes.map(t => (JSON.parse(t.payload) as JsonRecord)["title"]).join(","));
  }

  private static chat(id: string, title: string, edited: boolean): JsonRecord {
    return new Conversation(id, "pr1", title, ChatTitlesMigrationTests.created, ChatTitlesMigrationTests.updated, false, null, null, edited).toJson() as JsonRecord;
  }
}
