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
import { MigrationCatalog, ReplyIdentityMigration, Resources } from "@noldova/teamrun.core";

import { LegacyDatabaseContext } from "../../fixtures/legacy-database-context.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";
import { TestDatabase } from "../../fixtures/test-database.fixture.js";

@TestClass
export class ReplyIdentityMigrationTests {
  private static readonly identity: Record<string, unknown> =
    { email: "person@example.com", plan: "max", organization: "Org", authMethod: "claude.ai login" };

  @TestMethod
  public removesTheIdentityFromEachMessageAndItsChangesOnly(): void {
    const migration = new ReplyIdentityMigration();
    Assert.areEqual("20261102190000_ReplyIdentity", migration.id);
    Assert.isTrue(Resources.replyIdentityMigrationId > Resources.acpAgentsMigrationId);
    const builder = new MigrationBuilder();
    migration.apply(builder);

    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));

    Assert.areEqual([
      "UPDATE messages SET json = json_remove(json, '$.provenance.observed.identity') WHERE json_type(json, '$.provenance.observed.identity') IS NOT NULL",
      "UPDATE __changes SET payload = json_remove(payload, '$.provenance.observed.identity') WHERE entity = 'Message' "
        + "AND json_type(payload, '$.provenance.observed.identity') IS NOT NULL"
    ].join("\n"), statements.join("\n"));
  }

  @TestMethod
  public async dropsTheSignInEachReplyKeptAndLeavesEverythingElse(): Promise<void> {
    const kept = ReplyIdentityMigrationTests.reply("m2", ReplyIdentityMigrationTests.identity);
    const empty = ReplyIdentityMigrationTests.reply("m3", null);
    const sent = { id: "m1", chatId: "c1", provenance: null };
    const provider = { id: "a1", kind: "claude", identity: ReplyIdentityMigrationTests.identity };
    using directory = new TemporaryDataDirectory();
    {
      const before = MigrationCatalog.all.slice(0, MigrationCatalog.all.findIndex(t => t instanceof ReplyIdentityMigration));
      await using legacy = await LegacyTestDatabase.openAsync(directory.path, before);
      const execute = async (statement: string, parameters: readonly (string | number)[]): Promise<number> => legacy.database.connection.executeAsync(new SqlQuery(statement, parameters));
      await execute("INSERT INTO projects (id, rootPath, json, createdAt, updatedAt) VALUES ('pr1', '/work', '{}', 't', 't')", []);
      await execute("INSERT INTO chats (id, projectId, json, createdAt, updatedAt) VALUES ('c1', 'pr1', '{}', 't', 't')", []);
      for (const [index, message] of [sent, kept, empty].entries())
        await execute("INSERT INTO messages (id, chatId, sequence, status, json, createdAt, updatedAt) VALUES (?, 'c1', ?, 'Completed', ?, 't', 't')",
          [`m${index + 1}`, index + 1, JSON.stringify(message)]);
      await legacy.database.changeFeed.appendAsync("Message", "m2", ChangeOperation.Update, JSON.stringify(kept));
      await legacy.database.changeFeed.appendAsync("Provider", "a1", ChangeOperation.Update, JSON.stringify(provider));
    }
    await using current = await TestDatabase.openAsync(directory.path);
    const stored = (await current.database.connection.queryAsync(new SqlQuery("SELECT json FROM messages ORDER BY sequence"))).map(t => JSON.parse(t.readString(Resources.jsonColumn)));
    const changes = (await current.database.changeFeed.readAfterAsync(0)).map(t => JSON.parse(t.payload));

    Assert.areEqual(MigrationCatalog.all.length, (await current.database.getAppliedMigrationsAsync()).length);
    Assert.areEqual(JSON.stringify([sent, ReplyIdentityMigrationTests.reply("m2"), ReplyIdentityMigrationTests.reply("m3")]), JSON.stringify(stored));
    Assert.areEqual(JSON.stringify([ReplyIdentityMigrationTests.reply("m2"), provider]), JSON.stringify(changes));
    Assert.isFalse(JSON.stringify(stored).includes("person@example.com"));
  }

  private static reply(id: string, identity?: Record<string, unknown> | null): Record<string, unknown> {
    const observed = Object.isUndefined(identity)
      ? { kind: "claude", model: "opus", effort: "high", harnessVersion: "2.1.0", unavailableModel: false, speed: null, speedUnavailable: null }
      : { kind: "claude", model: "opus", effort: "high", harnessVersion: "2.1.0", identity, unavailableModel: false, speed: null, speedUnavailable: null };
    return { id, chatId: "c1", provenance: { providerId: "a1", requested: null, observed, sessionId: "s1" } };
  }
}
