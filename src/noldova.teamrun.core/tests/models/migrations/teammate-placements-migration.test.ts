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
import { MigrationCatalog, OrganizationService, Resources, TeammatePlacementsMigration } from "@noldova/teamrun.core";
import { OrganizationNodeKind, OrganizationParent } from "@noldova/teamrun.protocol";

import { LegacyDatabaseContext } from "../../fixtures/legacy-database-context.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";
import { TestDatabase } from "../../fixtures/test-database.fixture.js";

@TestClass
export class TeammatePlacementsMigrationTests {
  @TestMethod
  public keysEachPlacementToItsTeammateThenMovesTheMembershipsAndTheParents(): void {
    const migration = new TeammatePlacementsMigration();
    const builder = new MigrationBuilder();
    migration.apply(builder);
    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));

    Assert.areEqual("20261123090000_TeammatePlacements", migration.id);
    Assert.isTrue(statements[0]?.includes("\"teammatePlacements\"") ?? false);
    Assert.isTrue(statements[0]?.includes("PRIMARY KEY (\"teammateId\")") ?? false);
    Assert.isTrue(statements[0]?.includes("FOREIGN KEY (\"teammateId\") REFERENCES \"teammates\" (\"id\")") ?? false);
    Assert.areEqual([Resources.copyDepartmentMembersToPlacements, Resources.placeUnplacedTeammatesUnderPerson, Resources.dropDepartmentMembers,
      Resources.moveDepartmentParentsIntoJson].join("\n"), statements.slice(-4).join("\n"));
  }

  @TestMethod
  public async placesEachMemberUnderItsDepartmentInTheOrderItJoinedEachTeammateInNoneUnderThePersonAndGivesEachDepartmentItsParentNode(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    {
      const before = MigrationCatalog.all.slice(0, MigrationCatalog.all.findIndex(t => t instanceof TeammatePlacementsMigration));
      await using legacy = await LegacyTestDatabase.openAsync(directory.path, before);
      const execute = async (statement: string, parameters: readonly string[] = []): Promise<number> =>
        await legacy.database.connection.executeAsync(new SqlQuery(statement, parameters));
      for (const id of ["t1", "t2", "t3", "t5", "t4"])
        await execute("INSERT INTO teammates (id, name, json, createdAt, updatedAt) VALUES (?, ?, '{}', ?, 't')", [id, id, id === "t5" ? "2" : "1"]);
      await execute("INSERT INTO departments (id, parentId, json, createdAt, updatedAt) VALUES ('d1', NULL, ?, 'c', 'u')",
        ['{"id":"d1","name":"Top","parentId":null,"leaderId":"t2","order":0,"createdAt":"c","updatedAt":"u"}']);
      await execute("INSERT INTO departments (id, parentId, json, createdAt, updatedAt) VALUES ('d2', 'd1', ?, 'c', 'u')",
        ['{"id":"d2","name":"Inner","parentId":"d1","leaderId":null,"order":0,"createdAt":"c","updatedAt":"u"}']);
      await execute("INSERT INTO departmentMembers (teammateId, departmentId) VALUES ('t3', 'd1')");
      await execute("INSERT INTO departmentMembers (teammateId, departmentId) VALUES ('t1', 'd2')");
      await execute("INSERT INTO departmentMembers (teammateId, departmentId) VALUES ('t2', 'd1')");
    }
    await using current = await TestDatabase.openAsync(directory.path);
    const connection = current.database.connection;
    const [organization] = await new OrganizationService(current).listAsync();
    const tables = await connection.queryAsync(new SqlQuery("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'departmentMembers'"));

    Assert.areEqual(MigrationCatalog.all.length, (await current.database.getAppliedMigrationsAsync()).length);
    Assert.areEqual("t1:d2:0,t3:d1:0,t2:d1:1", organization?.placements.filter(t => t.parent.kind === OrganizationNodeKind.Department)
      .map(t => `${t.teammateId}:${t.parent.id ?? ""}:${t.order}`).join(","));
    Assert.areEqual("t4:0,t5:1", organization?.placementsUnder(OrganizationParent.person).toSorted((a, b) => a.order - b.order)
      .map(t => `${t.teammateId}:${t.order}`).join(","));
    Assert.areEqual("d1:Person:,d2:Department:d1", organization?.departments.map(t => `${t.id}:${t.parent.kind}:${t.parent.id ?? ""}`).join(","));
    Assert.areEqual("t2", organization?.departments[0]?.leaderId);
    Assert.areEqual("", organization?.unplaced(["t1", "t2", "t3", "t4", "t5"]).join(","));
    Assert.areEqual(0, tables.length);
    Assert.isFalse((await connection.queryAsync(new SqlQuery("SELECT json FROM departments"))).some(t => t.readString("json").includes("parentId")));
    await Assert.throwsAsync(() => connection.executeAsync(new SqlQuery("INSERT INTO teammatePlacements (organizationId, teammateId, json) VALUES ('my-organization', 't1', '{}')")), Error);
    await Assert.throwsAsync(() => connection.executeAsync(new SqlQuery("INSERT INTO teammatePlacements (organizationId, teammateId, json) VALUES ('my-organization', 'gone', '{}')")), Error);
  }
}
