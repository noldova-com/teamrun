/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MigrationBuilder, SqlQuery } from "@noldova/context.data.sql";
import { SQLiteDialect } from "@noldova/context.data.sql.sqlite";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ApprovalScopesMigration, MigrationCatalog, Resources } from "@noldova/teamrun.core";
import { Approval, ApprovalScope } from "@noldova/teamrun.protocol";
import { LegacyDatabaseContext } from "../../fixtures/legacy-database-context.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";
import { TestDatabase } from "../../fixtures/test-database.fixture.js";

@TestClass
export class ApprovalScopesMigrationTests {
  private static readonly legacyApproval: string = JSON.stringify({
    id: "ap1", messageId: "m1", kind: "Command", nativeKind: "commandExecution", summary: "Run tests", payload: null,
    options: [
      { id: "accept", label: "Allow", outcome: "Approved" },
      { id: "acceptForSession", label: "Allow for this session", outcome: "Approved" },
      { id: "decline", label: "Deny", outcome: "Denied" }
    ],
    status: "Approved", decision: "acceptForSession", createdAt: "t", decidedAt: "t"
  });

  @TestMethod
  public runsOneStatementUnderItsOwnId(): void {
    const migration = new ApprovalScopesMigration();
    Assert.areEqual("20261018120000_ApprovalScopes", migration.id);
    const builder = new MigrationBuilder();
    migration.apply(builder);

    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));

    Assert.areEqual(Resources.addApprovalOptionScopes, statements.join(";"));
  }

  @TestMethod
  public async givesEachStoredOptionAScopeInItsOrder(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    {
      await using legacy = await LegacyDatabaseContext.openAsync(directory.path);
      const insert = async (statement: string, parameters: readonly string[] = []): Promise<number> => legacy.database.connection.executeAsync(new SqlQuery(statement, parameters));
      await insert("INSERT INTO projects (id, rootPath, json, createdAt, updatedAt) VALUES ('p1', 'fixture', '{}', 't', 't')");
      await insert("INSERT INTO conversations (id, projectId, json, createdAt, updatedAt) VALUES ('c1', 'p1', '{}', 't', 't')");
      await insert("INSERT INTO messages (id, conversationId, sequence, status, json, createdAt, updatedAt) VALUES ('m1', 'c1', 1, 'Completed', '{}', 't', 't')");
      await insert("INSERT INTO approvals (id, messageId, status, json, createdAt, updatedAt) VALUES ('ap1', 'm1', 'Approved', ?, 't', 't')",
        [ApprovalScopesMigrationTests.legacyApproval]);
    }
    await using current = await TestDatabase.openAsync(directory.path);

    const json = (await current.database.connection.queryAsync(new SqlQuery("SELECT json FROM approvals WHERE id = 'ap1'")))[0]?.readString("json") ?? "";
    const approval = Approval.fromJson(JSON.parse(json));

    Assert.areEqual(MigrationCatalog.all.length, (await current.database.getAppliedMigrationsAsync()).length);
    Assert.areEqual("accept,acceptForSession,decline", approval.options.map(t => t.id).join(","));
    Assert.areEqual([ApprovalScope.Once, ApprovalScope.Session, ApprovalScope.Once].join(","), approval.options.map(t => t.scope).join(","));
    Assert.areEqual("acceptForSession", approval.decision);
    Assert.areEqual("Allow for this session", approval.options[1]?.label);
  }
}
