/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DataDirectory, ModuleDatabase } from "@noldova/desktop.runtime";
import { MigrationCatalog } from "@noldova/teamrun.core";
import { HostedMigrations, Pages } from "@noldova/teamrun.runtime";

import { MemoryModuleDatabase } from "../fixtures/memory-module-database.fixture.js";
import { RecordingOutput } from "../fixtures/recording-output.fixture.js";
import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class HostedMigrationsTests {
  @TestMethod
  public carriesTheChatEnginesAndThePagesMigrationsInOrderUnderDesktopCoreIds(): void {
    Assert.areEqual(MigrationCatalog.all.length + Pages.migrations.length, HostedMigrations.all.length);
    Assert.areEqual("20260908120000-initial,20260915120000-teammates,20261017120000-drafts,20261018120000-approvalscopes,20261018180000-forgottensessions,20261023180000-preferences,20261023200000-readingpositions,20261023210000-providernames,20261023220000-replycheckpoints,20261024190000-projectlessconversations,20261025120000-sharedmcpservers,20261025200000-chattitles,20261025210000-chatnames,20261025230000-chatlayoutnames,20261031220000-chatwakes,20261102000000-backgroundtasks,20261102180000-acpagents,20261102190000-replyidentity,20261103000000-waitingmessages,20261107000000-runoutputs,20261108000000-messagetext,20261111000000-pages,20261112000000-accountlimits,20261112010000-sustainattempts,20261112020000-sustainattemptreasons,20261112030000-handoversummaries,20261112040000-handoversummarykinds,20261119120000-checkpointfolders,20261120120000-departments,20261121090000-organizationmessages,20261122090000-teammatelastreplies,20261123090000-teammateplacements,20261124090000-organizationmessagesdrop,20261124090000-organizations,20261125090000-uniqueindexnames,20261126090000-nodetypes", HostedMigrations.all.map(t => t.id).join(","));
    Assert.isTrue(HostedMigrations.all.every(t => t.statements.length > 0));
  }

  @TestMethod
  public async letsAChatHaveNoProjectInDesktopCoresDatabaseKeepingEveryRowThatPointsAtAChat(): Promise<void> {
    using folder = new TemporaryDirectory();
    const directory = new DataDirectory(folder.path);
    const counted = [new CountedTable("projects", "projects"), new CountedTable("conversations", "chats"), new CountedTable("messages", "messages"),
      new CountedTable("teammates", "teammates"), new CountedTable("conversationTeammates", "chatTeammates"), new CountedTable("drafts", "drafts"),
      new CountedTable("readingPositions", "readingPositions")];
    const counts = (database: ModuleDatabase, legacy: boolean): string => counted
      .map(t => `${t.name} ${String(database.read(`SELECT COUNT(*) AS count FROM ${legacy ? t.earlier : t.name}`)?.["count"])}`).join(", ");
    let before = "";
    {
      const beforeChatNames = HostedMigrations.all.slice(0, HostedMigrations.all.findIndex(t => t.id === "20261025210000-chatnames"));
      using database = await ModuleDatabase.openAsync(directory, "teamrun", beforeChatNames, new Date(), new RecordingOutput());
      database.run("INSERT INTO projects (id, rootPath, json, createdAt, updatedAt) VALUES ('pr1', '/work', '{}', 't', 't')");
      database.run("INSERT INTO teammates (id, name, json, createdAt, updatedAt) VALUES ('t1', 'alice', '{}', 't', 't')");
      for (const id of ["c1", "c2"]) {
        database.run("INSERT INTO conversations (id, projectId, json, createdAt, updatedAt) VALUES (?, 'pr1', '{}', 't', 't')", id);
        database.run("INSERT INTO messages (id, conversationId, sequence, status, json, createdAt, updatedAt) VALUES (?, ?, 1, 'Completed', '{}', 't', 't')", `${id}m`, id);
        database.run("INSERT INTO conversationTeammates (conversationId, teammateId, json, joinedAt) VALUES (?, 't1', '{}', 't')", id);
        database.run("INSERT INTO readingPositions (conversationId, json, updatedAt) VALUES (?, '{}', 't')", id);
      }
      database.run("INSERT INTO drafts (conversationId, json, revision, updatedAt) VALUES ('c1', '{}', 1, 't')");
      before = counts(database, true);
    }

    using database = await ModuleDatabase.openAsync(directory, "teamrun", HostedMigrations.all, new Date(), new RecordingOutput());
    database.run("INSERT INTO chats (id, projectId, json, createdAt, updatedAt) VALUES ('c3', NULL, '{}', 't', 't')");

    Assert.areEqual("projects 1, chats 2, messages 2, teammates 1, chatTeammates 2, drafts 1, readingPositions 2", before);
    Assert.areEqual(before.replace("chats 2", "chats 3"), counts(database, false));
    Assert.areEqual(1, database.read("PRAGMA foreign_keys")?.["foreign_keys"]);
    Assert.areEqual(0, database.readAll("PRAGMA foreign_key_check").length);
    Assert.throws(() => database.run("INSERT INTO chats (id, projectId, json, createdAt, updatedAt) VALUES ('c4', 'missing', '{}', 't', 't')"), Error);
    Assert.throws(() => database.run("DELETE FROM chats WHERE id = 'c1'"), Error);
  }

  @TestMethod
  public buildsTheChatEnginesTablesInAnEmptyDatabase(): void {
    using database = new MemoryModuleDatabase(HostedMigrations.all);

    const tables = database.readAll("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").map(t => String(t["name"]));

    Assert.isTrue(tables.includes("projects"));
    Assert.isTrue(tables.includes("teammates"));
    Assert.isTrue(tables.includes("drafts"));
    Assert.isTrue(tables.includes("chats"));
    Assert.isTrue(tables.includes("chatTeammates"));
    Assert.isTrue(tables.includes("sharedMcpServers"));
    Assert.isTrue(tables.includes("waitingMessages"));
  }
}

class CountedTable {
  public readonly earlier: string;
  public readonly name: string;

  public constructor(earlier: string, name: string) {
    this.earlier = earlier;
    this.name = name;
  }
}
