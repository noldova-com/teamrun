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
import { ChatLayoutNamesMigration, MigrationCatalog, Resources } from "@noldova/teamrun.core";

import { LegacyDatabaseContext } from "../../fixtures/legacy-database-context.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";
import { TestDatabase } from "../../fixtures/test-database.fixture.js";

@TestClass
export class ChatLayoutNamesMigrationTests {
  private static readonly earlier: Record<string, unknown> =
    { collapsedProjects: ["p1"], pinnedConversations: ["c2", "c1"], projectOrder: ["p2", "p1"], conversationOrder: { p1: ["c3", "c1"] } };
  private static readonly moved: Record<string, unknown> =
    { collapsedProjects: ["p1"], projectOrder: ["p2", "p1"], pinnedChats: ["c2", "c1"], chatOrder: { p1: ["c3", "c1"] } };
  private static readonly other: Record<string, unknown> = { pinnedConversations: ["theirs"], conversationOrder: {} };

  @TestMethod
  public renamesTheLayoutsTwoFieldsInItsPreferenceAndItsChangesOnly(): void {
    const migration = new ChatLayoutNamesMigration();
    Assert.areEqual("20261025230000_ChatLayoutNames", migration.id);
    Assert.isTrue(Resources.chatLayoutNamesMigrationId > Resources.chatNamesMigrationId);
    const builder = new MigrationBuilder();
    migration.apply(builder);

    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));

    Assert.areEqual(1 + 2 * Resources.renamedLayoutFields.length, statements.length);
    Assert.areEqual("UPDATE preferences SET json = json_remove(json_insert(json, '$.pinnedChats', json_extract(json, '$.pinnedConversations')), "
      + "'$.pinnedConversations') WHERE name = 'projectsLayout' AND json_type(json, '$.pinnedConversations') IS NOT NULL", statements[1]);
    Assert.areEqual("UPDATE __changes SET payload = json_remove(json_insert(payload, '$.chatOrder', json_extract(payload, '$.conversationOrder')), "
      + "'$.conversationOrder') WHERE entity = 'Preference' AND entityId = 'projectsLayout' AND json_type(payload, '$.conversationOrder') IS NOT NULL",
    statements.at(-1));
  }

  @TestMethod
  public async movesAKeptLayoutAndItsChangesToTheNewNamesAndLeavesEverythingElse(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    {
      const before = MigrationCatalog.all.slice(0, MigrationCatalog.all.findIndex(t => t instanceof ChatLayoutNamesMigration));
      await using legacy = await LegacyDatabaseContext.openAsync(directory.path, before);
      const execute = async (statement: string, parameters: readonly string[]): Promise<number> => legacy.database.connection.executeAsync(new SqlQuery(statement, parameters));
      await execute("INSERT INTO preferences (name, json, updatedAt) VALUES (?, ?, 't')", [Resources.projectsLayoutPreference, JSON.stringify(ChatLayoutNamesMigrationTests.earlier)]);
      await execute("INSERT INTO preferences (name, json, updatedAt) VALUES (?, ?, 't')", ["other", JSON.stringify(ChatLayoutNamesMigrationTests.other)]);
      await legacy.database.changeFeed.appendAsync("Preference", Resources.projectsLayoutPreference, ChangeOperation.Update, JSON.stringify(ChatLayoutNamesMigrationTests.earlier));
      await legacy.database.changeFeed.appendAsync("Preference", "other", ChangeOperation.Update, JSON.stringify(ChatLayoutNamesMigrationTests.other));
    }
    await using current = await TestDatabase.openAsync(directory.path);
    const json = async (name: string): Promise<unknown> =>
      JSON.parse((await current.database.connection.queryAsync(new SqlQuery(Resources.selectPreference, [name])))[0]?.readString(Resources.jsonColumn) ?? "null");
    const changes = await current.database.changeFeed.readAfterAsync(0);

    Assert.areEqual(MigrationCatalog.all.length, (await current.database.getAppliedMigrationsAsync()).length);
    Assert.areEqual(JSON.stringify(ChatLayoutNamesMigrationTests.moved), JSON.stringify(await json(Resources.projectsLayoutPreference)));
    Assert.areEqual(JSON.stringify(ChatLayoutNamesMigrationTests.other), JSON.stringify(await json("other")));
    Assert.areEqual(JSON.stringify(ChatLayoutNamesMigrationTests.moved), changes[0]?.payload);
    Assert.areEqual(JSON.stringify(ChatLayoutNamesMigrationTests.other), changes[1]?.payload);
  }

  @TestMethod
  public async leavesALayoutAlreadyUnderTheNewNamesAsItIs(): Promise<void> {
    const [json, payload] = await ChatLayoutNamesMigrationTests.migrateAsync(ChatLayoutNamesMigrationTests.moved);

    Assert.areEqual(JSON.stringify(ChatLayoutNamesMigrationTests.moved), json);
    Assert.areEqual(JSON.stringify(ChatLayoutNamesMigrationTests.moved), payload);
  }

  @TestMethod
  public async keepsTheNewValueOfAFieldALayoutHasUnderBothNamesDropsTheOldOneAndStillMovesAFieldOnlyUnderItsOldName(): Promise<void> {
    const both = { collapsedProjects: ["p1"], pinnedConversations: ["c9"], pinnedChats: ["c2", "c1"], conversationOrder: { p1: ["c3", "c1"] } };
    const expected = { collapsedProjects: ["p1"], pinnedChats: ["c2", "c1"], chatOrder: { p1: ["c3", "c1"] } };

    const [json, payload] = await ChatLayoutNamesMigrationTests.migrateAsync(both);

    Assert.areEqual(JSON.stringify(expected), json);
    Assert.areEqual(JSON.stringify(expected), payload);
  }

  private static async migrateAsync(layout: Record<string, unknown>): Promise<[string, string | undefined]> {
    using directory = new TemporaryDataDirectory();
    {
      const before = MigrationCatalog.all.slice(0, MigrationCatalog.all.findIndex(t => t instanceof ChatLayoutNamesMigration));
      await using legacy = await LegacyDatabaseContext.openAsync(directory.path, before);
      await legacy.database.connection.executeAsync(new SqlQuery("INSERT INTO preferences (name, json, updatedAt) VALUES (?, ?, 't')",
        [Resources.projectsLayoutPreference, JSON.stringify(layout)]));
      await legacy.database.changeFeed.appendAsync("Preference", Resources.projectsLayoutPreference, ChangeOperation.Update, JSON.stringify(layout));
    }
    await using current = await TestDatabase.openAsync(directory.path);
    const json = (await current.database.connection.queryAsync(new SqlQuery(Resources.selectPreference, [Resources.projectsLayoutPreference])))[0]?.readString(Resources.jsonColumn);
    return [JSON.stringify(JSON.parse(json ?? "null")), (await current.database.changeFeed.readAfterAsync(0))[0]?.payload];
  }
}
