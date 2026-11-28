/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { MigrationBuilder, SqlQuery } from "@noldova/context.data.sql";
import { SQLiteDialect } from "@noldova/context.data.sql.sqlite";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { MigrationCatalog, OrganizationService, OrganizationsMigration, Resources, TeammatePlacementsMigration } from "@noldova/teamrun.core";
import { OrganizationIdParams } from "@noldova/teamrun.protocol";

import { LegacyDatabaseContext } from "../../fixtures/legacy-database-context.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";
import { TestDatabase } from "../../fixtures/test-database.fixture.js";

@TestClass
export class OrganizationsMigrationTests {
  @TestMethod
  public keysTheDepartmentsAndPlacementsToTheirOrganization(): void {
    const migration = new OrganizationsMigration();
    const builder = new MigrationBuilder();
    migration.apply(builder);
    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));
    const placements = statements.find(t => t.startsWith("CREATE TABLE \"teammatePlacements\"")) ?? "";
    const departments = statements.find(t => t.startsWith("CREATE TABLE \"departments\"")) ?? "";

    Assert.areEqual("20261124090000_Organizations", migration.id);
    Assert.isTrue(placements.includes("PRIMARY KEY (\"organizationId\", \"teammateId\")"));
    Assert.isTrue(placements.includes("FOREIGN KEY (\"organizationId\") REFERENCES \"organizations\" (\"id\")"));
    Assert.isTrue(departments.includes("FOREIGN KEY (\"organizationId\") REFERENCES \"organizations\" (\"id\")"));
    Assert.areEqual(Resources.moveOrganizationLayout, statements.at(-1));
  }

  @TestMethod
  public async movesTheTreeIntoMyOrganizationAndLeavesATeammateWithNoPlaceOutOfIt(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    {
      const before = MigrationCatalog.all.slice(0, MigrationCatalog.all.findIndex(t => t instanceof OrganizationsMigration));
      await using legacy = await LegacyDatabaseContext.openAsync(directory.path, before);
      const execute = async (statement: string, parameters: readonly string[] = []): Promise<number> =>
        await legacy.database.connection.executeAsync(new SqlQuery(statement, parameters));
      for (const id of ["t1", "t2", "t3", "t4"])
        await execute("INSERT INTO teammates (id, name, json, createdAt, updatedAt) VALUES (?, ?, '{}', 't', 't')", [id, id]);
      await execute("INSERT INTO departments (id, parentId, json, createdAt, updatedAt) VALUES ('d1', NULL, ?, 'c', 'u')",
        ['{"id":"d1","name":"Top","parent":{"kind":"Person","id":null},"leaderId":"t1","order":0,"createdAt":"c","updatedAt":"u"}']);
      await execute("INSERT INTO departments (id, parentId, json, createdAt, updatedAt) VALUES ('d2', 'd1', ?, 'c', 'u')",
        ['{"id":"d2","name":"Inner","parent":{"kind":"Department","id":"d1"},"leaderId":null,"order":0,"createdAt":"c","updatedAt":"u"}']);
      await execute("INSERT INTO teammatePlacements (teammateId, json) VALUES ('t1', ?)",
        ['{"teammateId":"t1","parent":{"kind":"Department","id":"d1"},"order":0}']);
      await execute("INSERT INTO teammatePlacements (teammateId, json) VALUES ('t2', ?)",
        ['{"teammateId":"t2","parent":{"kind":"Person","id":null},"order":0}']);
      await execute("INSERT INTO preferences (name, json, updatedAt) VALUES ('organizationLayout', '{\"collapsed\":[\"d2\"]}', 'u')");
    }
    await using current = await TestDatabase.openAsync(directory.path);
    const connection = current.database.connection;
    const service = new OrganizationService(current);
    const organizations = await service.listAsync();
    const [mine] = organizations;
    const old = await connection.queryAsync(new SqlQuery("SELECT name FROM preferences WHERE name = 'organizationLayout'"));

    Assert.areEqual(MigrationCatalog.all.length, (await current.database.getAppliedMigrationsAsync()).length);
    Assert.areEqual("my-organization|My organization|null|0", organizations.map(t => [t.id, t.name, String(t.folder), t.order].join("|")).join(","));
    Assert.areEqual("t1:d1:0,t2::0", mine?.placements.map(t => `${t.teammateId}:${t.parent.id ?? ""}:${t.order}`).join(","));
    Assert.areEqual("d1:Person:,d2:Department:d1", mine?.departments.map(t => `${t.id}:${t.parent.kind}:${t.parent.id ?? ""}`).join(","));
    Assert.areEqual("t1", mine?.departments[0]?.leaderId);
    Assert.areEqual('{"collapsed":["d2"]}', JSON.stringify(await service.readLayoutAsync(new OrganizationIdParams("my-organization"))));
    Assert.areEqual(0, old.length);
    Assert.areEqual(0, (await connection.queryAsync(new SqlQuery("SELECT name FROM sqlite_master WHERE name LIKE '%Copy'"))).length);
    await Assert.throwsAsync(() => connection.executeAsync(new SqlQuery("INSERT INTO teammatePlacements (organizationId, teammateId, json) VALUES ('my-organization', 't1', '{}')")), Error);
    await Assert.throwsAsync(() => connection.executeAsync(new SqlQuery("INSERT INTO teammatePlacements (organizationId, teammateId, json) VALUES ('gone', 't1', '{}')")), Error);
    await Assert.throwsAsync(() => connection.executeAsync(new SqlQuery(
      "INSERT INTO departments (id, organizationId, parentId, json, createdAt, updatedAt) VALUES ('d3', 'gone', NULL, '{}', 'c', 'u')")), Error);
  }

  @TestMethod
  public async makesNoOrganizationForADatabaseWithTeammatesAndNoDepartments(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    {
      const before = MigrationCatalog.all.slice(0, MigrationCatalog.all.findIndex(t => t instanceof TeammatePlacementsMigration));
      await using legacy = await LegacyDatabaseContext.openAsync(directory.path, before);
      for (const id of ["t1", "t2"])
        await legacy.database.connection.executeAsync(new SqlQuery("INSERT INTO teammates (id, name, json, createdAt, updatedAt) VALUES (?, ?, '{}', 't', 't')", [id, id]));
    }
    await using current = await TestDatabase.openAsync(directory.path);
    const connection = current.database.connection;

    Assert.areEqual(MigrationCatalog.all.length, (await current.database.getAppliedMigrationsAsync()).length);
    Assert.areEqual(0, (await new OrganizationService(current).listAsync()).length);
    Assert.areEqual(0, (await connection.queryAsync(new SqlQuery("SELECT teammateId FROM teammatePlacements"))).length);
    Assert.areEqual(2, (await connection.queryAsync(new SqlQuery("SELECT id FROM teammates"))).length);
  }

  @TestMethod
  public async startsAnEmptyDatabaseWithNoOrganization(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using current = await TestDatabase.openAsync(directory.path);

    Assert.areEqual(0, (await new OrganizationService(current).listAsync()).length);
  }
}
