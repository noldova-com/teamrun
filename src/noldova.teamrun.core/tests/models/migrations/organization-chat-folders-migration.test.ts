/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ChangeOperation } from "@noldova/context.data";
import { MigrationBuilder, SqlQuery } from "@noldova/context.data.sql";
import { SQLiteDialect } from "@noldova/context.data.sql.sqlite";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChangeEntity, DatabaseContext, MigrationCatalog, OrganizationChatFoldersMigration, Resources } from "@noldova/teamrun.core";
import { Conversation, Organization, OrganizationChat } from "@noldova/teamrun.protocol";

import { LegacyDatabaseContext } from "../../fixtures/legacy-database-context.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class OrganizationChatFoldersMigrationTests {
  @TestMethod
  public runsTheStatementsThatKeepEachStartedOrganizationChatsFolder(): void {
    const migration = new OrganizationChatFoldersMigration();
    const builder = new MigrationBuilder();
    migration.apply(builder);

    Assert.areEqual("20261127090000_OrganizationChatFolders", migration.id);
    Assert.areEqual(Resources.keepOrganizationChatFolders.join(";"), builder.toOperations().map(t => t.render(new SQLiteDialect())).join(";"));
  }

  @TestMethod
  public async attachesTheDefaultFolderOnlyToAnOrganizationChatThatRanThereStoredAndInTheChangeFeed(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const chat = (id: string, organizationId: string | null, attached: string | null): string => JSON.stringify(new Conversation(id, null, id, "t", "t", false, null, null,
      false, null, false, [], false, false, attached, Object.isNull(organizationId) ? null : new OrganizationChat(organizationId, "t1")).toJson());
    const chats = [chat("c1", "studio", null), chat("c2", "studio", null), chat("c3", "studio", "/own"), chat("c4", Resources.defaultOrganizationId, null),
      chat("c5", null, null)];
    {
      const before = MigrationCatalog.all.slice(0, MigrationCatalog.all.findIndex(t => t instanceof OrganizationChatFoldersMigration));
      await using legacy = await LegacyDatabaseContext.openAsync(directory.path, before);
      const execute = async (statement: string, parameters: readonly string[]): Promise<number> =>
        await legacy.database.connection.executeAsync(new SqlQuery(statement, parameters));
      await execute("INSERT INTO organizations (id, json, createdAt, updatedAt) VALUES ('studio', ?, 'c', 'u')",
        [JSON.stringify(new Organization("studio", "Studio", "/work/studio", 1, "c", "u", [], [], []).toJson())]);
      for (const [index, json] of chats.entries()) {
        const id = `c${index + 1}`;
        await execute("INSERT INTO chats (id, projectId, json, createdAt, updatedAt) VALUES (?, NULL, ?, 't', 't')", [id, json]);
        await legacy.database.changeFeed.appendAsync(ChangeEntity.Chat, id, ChangeOperation.Insert, json);
        if (id !== "c2")
          await execute("INSERT INTO messages (id, chatId, sequence, status, json, createdAt, updatedAt) VALUES (?, ?, 1, 'Completed', '{}', 't', 't')", [`m${id}`, id]);
      }
    }
    await using current = await DatabaseContext.openAsync(directory.path);
    const folders = await current.database.connection.queryAsync(new SqlQuery(
      "SELECT id || ':' || COALESCE(json_extract(json, '$.attachedFolder'), '-') AS folder FROM chats ORDER BY id"));
    const changes = (await current.database.changeFeed.readAfterAsync(0)).filter(t => t.entity === ChangeEntity.Chat);

    Assert.areEqual(MigrationCatalog.all.length, (await current.database.getAppliedMigrationsAsync()).length);
    Assert.areEqual("c1:/work/studio,c2:-,c3:/own,c4:-,c5:-", folders.map(t => t.readString("folder")).join(","));
    Assert.areEqual([`${chats[0]?.slice(0, -1) ?? String.empty},"attachedFolder":"/work/studio"}`, ...chats.slice(1)].join("|"), changes.map(t => t.payload).join("|"));
  }
}
