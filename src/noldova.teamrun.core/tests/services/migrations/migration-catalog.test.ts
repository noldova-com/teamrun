/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { InitialMigration, MigrationCatalog, OrganizationMessagesDropMigration, OrganizationsMigration, Resources, TeammatePlacementsMigration } from "@noldova/teamrun.core";

@TestClass
export class MigrationCatalogTests {
  @TestMethod
  public startsWithTheInitialSchemaAndEndsWithThePlacementsTheOrganizationMessagesDropThenTheOrganizations(): void {
    Assert.areEqual(33, MigrationCatalog.all.length);
    Assert.isInstanceOf(MigrationCatalog.all.at(-1), OrganizationsMigration);
    Assert.isInstanceOf(MigrationCatalog.all.at(-2), OrganizationMessagesDropMigration);
    Assert.isInstanceOf(MigrationCatalog.all.at(-3), TeammatePlacementsMigration);
    Assert.isInstanceOf(MigrationCatalog.all[0], InitialMigration);
    Assert.areEqual(Resources.initialMigrationId, MigrationCatalog.all[0]?.id);
  }
}
