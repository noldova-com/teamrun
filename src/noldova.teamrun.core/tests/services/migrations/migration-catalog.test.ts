/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { InitialMigration, MigrationCatalog, NodeTypesMigration, OrganizationMessagesDropMigration, OrganizationsMigration, Resources, TeammatePlacementsMigration, UniqueIndexNamesMigration } from "@noldova/teamrun.core";

@TestClass
export class MigrationCatalogTests {
  @TestMethod
  public startsWithTheInitialSchemaAndEndsWithThePlacementsTheOrganizationMessagesDropTheOrganizationsThenTheUniqueIndexNamesThenTheNodeTypes(): void {
    Assert.areEqual(35, MigrationCatalog.all.length);
    Assert.isInstanceOf(MigrationCatalog.all.at(-1), NodeTypesMigration);
    Assert.isInstanceOf(MigrationCatalog.all.at(-2), UniqueIndexNamesMigration);
    Assert.isInstanceOf(MigrationCatalog.all.at(-3), OrganizationsMigration);
    Assert.isInstanceOf(MigrationCatalog.all.at(-4), OrganizationMessagesDropMigration);
    Assert.isInstanceOf(MigrationCatalog.all.at(-5), TeammatePlacementsMigration);
    Assert.isInstanceOf(MigrationCatalog.all[0], InitialMigration);
    Assert.areEqual(Resources.initialMigrationId, MigrationCatalog.all[0]?.id);
  }

  @TestMethod
  public listsTheMigrationsInTheOrderOfTheirIdsSoANewOneNeedsTheHighestId(): void {
    const ids = MigrationCatalog.all.map(t => t.id);
    Assert.areEqual(ids.length, new Set(ids).size);
    Assert.areEqual(ids.join(","), [...ids].sort((a, b) => a.localeCompare(b)).join(","));
  }
}
