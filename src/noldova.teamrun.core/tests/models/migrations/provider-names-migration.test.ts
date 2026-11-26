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
import { MigrationCatalog, ProviderNamesMigration, Resources } from "@noldova/teamrun.core";
import {
  AuthStatus,
  Conversation,
  ConversationResponder,
  DefaultTeammate,
  DetailKind,
  ForkedSession,
  Harness,
  Message,
  MessageAuthor,
  MessageDetail,
  MessageStatus,
  ObservedSettings,
  Project,
  Provenance,
  Provider,
  RequestedSettings,
  Teammate
} from "@noldova/teamrun.protocol";

import { LegacyDatabaseContext } from "../../fixtures/legacy-database-context.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";
import { TestDatabase } from "../../fixtures/test-database.fixture.js";

type JsonRecord = Record<string, unknown>;

@TestClass
export class ProviderNamesMigrationTests {
  private static readonly toolPayload: JsonRecord = { provider: "aws", input: { provider: "gcp", providerAccountId: "theirs" } };

  @TestMethod
  public renamesTheTableItsColumnAndIndexAndEachKnownFieldUnderItsOwnId(): void {
    const migration = new ProviderNamesMigration();
    Assert.areEqual("20261023210000_ProviderNames", migration.id);
    const builder = new MigrationBuilder();
    migration.apply(builder);

    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));

    Assert.areEqual(6 + 2 * Resources.renamedProviderFields.length, statements.length);
    Assert.areEqual("ALTER TABLE providerAccounts RENAME TO providers", statements[0]);
    Assert.areEqual("ALTER TABLE providers RENAME COLUMN provider TO kind", statements[1]);
    Assert.areEqual("DROP INDEX IX_providerAccounts_provider", statements[2]);
    Assert.areEqual("CREATE INDEX \"IX_providers_kind\" ON \"providers\" (\"kind\")", statements[3]);
    Assert.areEqual("UPDATE __changes SET entity = 'Provider' WHERE entity = 'ProviderAccount'", statements[5]);
    Assert.areEqual("UPDATE preferences SET json = json_remove(json_insert(json, '$.requested.kind', json_extract(json, '$.requested.provider')), "
      + "'$.requested.provider') WHERE name = 'defaultTeammate' AND json_type(json, '$.requested.provider') IS NOT NULL", statements.at(-2));
    Assert.areEqual("UPDATE __changes SET payload = json_remove(json_insert(payload, '$.requested.kind', json_extract(payload, '$.requested.provider')), "
      + "'$.requested.provider') WHERE entity = 'Preference' AND entityId = 'defaultTeammate' AND json_type(payload, '$.requested.provider') IS NOT NULL",
    statements.at(-1));
  }

  @TestMethod
  public async keepsEveryProviderTeammateChatMessageAndDefaultOfADatabaseFromBeforeIt(): Promise<void> {
    const project = new Project("pr1", "Work", "/work", "t");
    const provider = new Provider("p1", "claude", "Work", "/profiles/work", AuthStatus.Unknown, null, null, null, null, "t");
    const teammate = new Teammate("t1", "Alice", null, "p1", Harness.Provider, "opus", "high", "t", "t");
    const requested = new RequestedSettings("claude", "opus", null);
    const conversation = new Conversation("c1", "pr1", "Chat", "t", "t", false, new ForkedSession("claude", "p1", "s1"), new ConversationResponder(null, requested, "p1"));
    const message = new Message("m1", "c1", 1, MessageAuthor.Provider, null, MessageStatus.Completed,
      [new MessageDetail(1, DetailKind.Text, "Done", ProviderNamesMigrationTests.toolPayload as never, "t")],
      new Provenance("p1", requested, new ObservedSettings("claude", "opus", null, "2.1"), "s1", false), "t", "t", "t");
    const defaultTeammate = new DefaultTeammate(requested, "p1");
    const old = {
      provider: ProviderNamesMigrationTests.renamed(provider.toJson(), "kind", "provider"),
      teammate: ProviderNamesMigrationTests.renamed(teammate.toJson(), "providerId", "providerAccountId"),
      conversation: ProviderNamesMigrationTests.oldConversation(conversation),
      message: ProviderNamesMigrationTests.oldMessage(message),
      defaultTeammate: ProviderNamesMigrationTests.oldDefault(defaultTeammate)
    };
    using directory = new TemporaryDataDirectory();
    {
      const before = MigrationCatalog.all.slice(0, MigrationCatalog.all.findIndex(t => t instanceof ProviderNamesMigration));
      await using legacy = await LegacyDatabaseContext.openAsync(directory.path, before);
      const execute = async (statement: string, parameters: readonly (string | number)[]): Promise<number> => legacy.database.connection.executeAsync(new SqlQuery(statement, parameters));
      await execute("INSERT INTO projects (id, rootPath, json, createdAt, updatedAt) VALUES (?, ?, ?, 't', 't')", [project.id, project.rootPath, JSON.stringify(project.toJson())]);
      await execute("INSERT INTO providerAccounts (id, provider, json, createdAt, updatedAt) VALUES (?, ?, ?, 't', 't')", ["p1", "claude", JSON.stringify(old.provider)]);
      await execute("INSERT INTO teammates (id, name, json, createdAt, updatedAt) VALUES (?, ?, ?, 't', 't')", ["t1", "alice", JSON.stringify(old.teammate)]);
      await execute("INSERT INTO conversations (id, projectId, json, createdAt, updatedAt) VALUES (?, ?, ?, 't', 't')", ["c1", "pr1", JSON.stringify(old.conversation)]);
      await execute("INSERT INTO messages (id, conversationId, sequence, status, json, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 't', 't')",
        ["m1", "c1", 1, MessageStatus.Completed, JSON.stringify(old.message)]);
      await execute("INSERT INTO preferences (name, json, updatedAt) VALUES (?, ?, 't')", [Resources.defaultTeammatePreference, JSON.stringify(old.defaultTeammate)]);
      await legacy.database.changeFeed.appendAsync("ProviderAccount", "p1", ChangeOperation.Insert, JSON.stringify(old.provider));
      await legacy.database.changeFeed.appendAsync("Message", "m1", ChangeOperation.Update, JSON.stringify(old.message));
      await legacy.database.changeFeed.appendAsync("Preference", Resources.defaultTeammatePreference, ChangeOperation.Update, JSON.stringify(old.defaultTeammate));
      await legacy.database.changeFeed.appendAsync("Approval", "a1", ChangeOperation.Insert, JSON.stringify({ input: { provider: "theirs" }, provider: "theirs" }));
    }
    await using current = await TestDatabase.openAsync(directory.path);
    const json = async (statement: string): Promise<string> => (await current.database.connection.queryAsync(new SqlQuery(statement)))[0]?.readString("json") ?? "";

    Assert.areEqual(MigrationCatalog.all.length, (await current.database.getAppliedMigrationsAsync()).length);
    Assert.areEqual("claude", (await current.database.connection.queryAsync(new SqlQuery("SELECT kind FROM providers WHERE id = 'p1'")))[0]?.readString("kind"));
    Assert.areEqual("IX_providers_kind", (await current.database.connection.queryAsync(
      new SqlQuery("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'providers' AND name LIKE 'IX_%'")))
      .map(t => t.readString("name")).join(","));
    Assert.areEqual(JSON.stringify(provider.toJson()), ProviderNamesMigrationTests.read(await json("SELECT json FROM providers"), Provider));
    Assert.areEqual(JSON.stringify(teammate.toJson()), ProviderNamesMigrationTests.read(await json("SELECT json FROM teammates"), Teammate));
    Assert.areEqual(JSON.stringify(conversation.toJson()), ProviderNamesMigrationTests.read(await json("SELECT json FROM chats"), Conversation));
    Assert.areEqual(JSON.stringify(message.toJson()), ProviderNamesMigrationTests.read(await json("SELECT json FROM messages"), Message));
    Assert.areEqual(JSON.stringify(defaultTeammate.toJson()), ProviderNamesMigrationTests.read(await json("SELECT json FROM preferences"), DefaultTeammate));
    const details = (JSON.parse(await json("SELECT json FROM messages")) as { details: { payload: unknown }[] }).details;
    Assert.areEqual(JSON.stringify(ProviderNamesMigrationTests.toolPayload), JSON.stringify(details[0]?.payload));
    const changes = await current.database.changeFeed.readAfterAsync(0);
    Assert.areEqual("Provider,Message,Preference,Approval", changes.map(t => t.entity).join(","));
    Assert.areEqual(JSON.stringify(provider.toJson()), ProviderNamesMigrationTests.read(changes[0]?.payload ?? "", Provider));
    Assert.areEqual(JSON.stringify(message.toJson()), ProviderNamesMigrationTests.read(changes[1]?.payload ?? "", Message));
    Assert.areEqual(JSON.stringify(defaultTeammate.toJson()), ProviderNamesMigrationTests.read(changes[2]?.payload ?? "", DefaultTeammate));
    Assert.areEqual(JSON.stringify({ input: { provider: "theirs" }, provider: "theirs" }), changes[3]?.payload);
  }

  private static read(json: string, model: { fromJson(value: unknown): { toJson(): unknown } }): string {
    return JSON.stringify(model.fromJson(JSON.parse(json)).toJson());
  }

  private static oldConversation(conversation: Conversation): JsonRecord {
    const json = conversation.toJson() as JsonRecord;
    const responder = json["responder"] as JsonRecord;
    return {
      ...json,
      forkedSession: ProviderNamesMigrationTests.renamed(ProviderNamesMigrationTests.renamed(json["forkedSession"] as JsonRecord, "kind", "provider"),
        "providerId", "providerAccountId"),
      responder: ProviderNamesMigrationTests.renamed({ ...responder, requested: ProviderNamesMigrationTests.renamed(responder["requested"] as JsonRecord, "kind", "provider") },
        "providerId", "providerAccountId")
    };
  }

  private static oldMessage(message: Message): JsonRecord {
    const json = message.toJson() as JsonRecord;
    const provenance = json["provenance"] as JsonRecord;
    return {
      ...json,
      provenance: ProviderNamesMigrationTests.renamed({
        ...provenance,
        requested: ProviderNamesMigrationTests.renamed(provenance["requested"] as JsonRecord, "kind", "provider"),
        observed: ProviderNamesMigrationTests.renamed(provenance["observed"] as JsonRecord, "kind", "provider")
      }, "providerId", "providerAccountId")
    };
  }

  private static oldDefault(defaultTeammate: DefaultTeammate): JsonRecord {
    const json = defaultTeammate.toJson() as JsonRecord;
    return ProviderNamesMigrationTests.renamed({ ...json, requested: ProviderNamesMigrationTests.renamed(json["requested"] as JsonRecord, "kind", "provider") },
      "providerId", "providerAccountId");
  }

  private static renamed(value: unknown, from: string, to: string): JsonRecord {
    return Object.fromEntries(Object.entries(value as JsonRecord).map(([key, item]) => [key === from ? to : key, item]));
  }
}
