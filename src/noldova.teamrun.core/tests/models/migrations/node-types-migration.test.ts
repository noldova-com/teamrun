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
import { ChangeEntity, DatabaseContext, MigrationCatalog, NodeTypesMigration, OrganizationService, Resources } from "@noldova/teamrun.core";
import { Department, NodeType, Organization, OrganizationParent } from "@noldova/teamrun.protocol";

import { LegacyDatabaseContext } from "../../fixtures/legacy-database-context.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class NodeTypesMigrationTests {
  private static readonly untyped: string = '{"id":"d1","name":"Top","parent":{"kind":"Person","id":null},"leaderId":null,"order":0,"createdAt":"c","updatedAt":"u"}';

  @TestMethod
  public runsTheDefaultNodeTypeStatements(): void {
    const migration = new NodeTypesMigration();
    const builder = new MigrationBuilder();
    migration.apply(builder);

    Assert.areEqual("20261126090000_NodeTypes", migration.id);
    Assert.areEqual(Resources.addDefaultNodeTypes.join(";"), builder.toOperations().map(t => t.render(new SQLiteDialect())).join(";"));
  }

  @TestMethod
  public async givesTheDepartmentTypeToEachOrganizationWithDepartmentsNoTypeToTheOthersAndLeavesTypedOnesAsTheyAre(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const team = new NodeType("team", "Team", "groups", "teal", "c", "u");
    const studio = JSON.stringify(new Organization("studio", "Studio", null, 1, "c", "u", [team], [], []).toJson());
    const art = JSON.stringify(new Department("d2", "Art", "team", OrganizationParent.person, null, 0, "c", "u").toJson());
    const old = '{"id":"o9","name":"Old","folder":null,"order":2,"createdAt":"c9","updatedAt":"u9","departments":[],"placements":[]}';
    const renamed = '{"id":"my-organization","name":"Mine","folder":null,"order":0,"createdAt":"c1","updatedAt":"u1","departments":[],"placements":[]}';
    {
      const before = MigrationCatalog.all.slice(0, MigrationCatalog.all.findIndex(t => t instanceof NodeTypesMigration));
      await using legacy = await LegacyDatabaseContext.openAsync(directory.path, before);
      const execute = async (statement: string, parameters: readonly string[]): Promise<number> =>
        await legacy.database.connection.executeAsync(new SqlQuery(statement, parameters));
      await execute("INSERT INTO organizations (id, json, createdAt, updatedAt) VALUES ('studio', ?, 'c', 'u')", [studio]);
      await execute("INSERT INTO organizations (id, json, createdAt, updatedAt) VALUES ('o9', ?, 'c9', 'u9')", [old]);
      await execute("INSERT INTO departments (id, organizationId, parentId, json, createdAt, updatedAt) VALUES ('d1', 'my-organization', NULL, ?, 'c', 'u')",
        [NodeTypesMigrationTests.untyped]);
      await execute("INSERT INTO departments (id, organizationId, parentId, json, createdAt, updatedAt) VALUES ('d2', 'studio', NULL, ?, 'c', 'u')", [art]);
      await legacy.database.changeFeed.appendAsync(ChangeEntity.Organization, "o9", ChangeOperation.Insert, old);
      await legacy.database.changeFeed.appendAsync(ChangeEntity.Organization, "my-organization", ChangeOperation.Update, renamed);
      await legacy.database.changeFeed.appendAsync(ChangeEntity.Organization, "studio", ChangeOperation.Insert, studio);
      await legacy.database.changeFeed.appendAsync(ChangeEntity.Department, "d1", ChangeOperation.Insert, NodeTypesMigrationTests.untyped);
      await legacy.database.changeFeed.appendAsync(ChangeEntity.Department, "d2", ChangeOperation.Insert, art);
    }
    await using current = await DatabaseContext.openAsync(directory.path);
    const [mine, other, empty] = await new OrganizationService(current).listAsync();
    const changes = (await current.database.changeFeed.readAfterAsync(0)).filter(t => t.entity === ChangeEntity.Organization || t.entity === ChangeEntity.Department);

    Assert.areEqual(MigrationCatalog.all.length, (await current.database.getAppliedMigrationsAsync()).length);
    Assert.areEqual(`department|Department|null|null|${mine?.createdAt ?? ""}|${mine?.createdAt ?? ""}`,
      mine?.nodeTypes.map(t => [t.id, t.name, String(t.icon), String(t.color), t.createdAt, t.updatedAt].join("|")).join(","));
    Assert.areEqual("department", mine?.departments[0]?.typeId);
    Assert.areEqual(JSON.stringify([team.toJson()]), JSON.stringify(other?.nodeTypes.map(t => t.toJson())));
    Assert.areEqual("team", other?.departments[0]?.typeId);
    Assert.areEqual("o9|0", `${empty?.id ?? ""}|${empty?.nodeTypes.length ?? -1}`);
    Assert.areEqual([
      `${old.slice(0, -1)},"nodeTypes":[]}`,
      `${renamed.slice(0, -1)},"nodeTypes":${JSON.stringify([new NodeType("department", "Department", null, null, "c1", "c1").toJson()])}}`,
      studio,
      `${NodeTypesMigrationTests.untyped.slice(0, -1)},"typeId":"department"}`,
      art].join("|"), changes.map(t => t.payload).join("|"));
  }
}
