/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { InitialMigration, MigrationCatalog, OrganizationMessagesMigration, Resources } from "@noldova/teamrun.core";

@TestClass
export class MigrationCatalogTests {
  @TestMethod
  public startsWithTheInitialSchemaAndEndsWithTheOrganizationMessages(): void {
    Assert.areEqual(29, MigrationCatalog.all.length);
    Assert.isInstanceOf(MigrationCatalog.all.at(-1), OrganizationMessagesMigration);
    Assert.isInstanceOf(MigrationCatalog.all[0], InitialMigration);
    Assert.areEqual(Resources.initialMigrationId, MigrationCatalog.all[0]?.id);
  }
}
