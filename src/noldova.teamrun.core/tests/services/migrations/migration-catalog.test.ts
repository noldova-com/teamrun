/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { InitialMigration, MigrationCatalog, Resources, TeammateLastRepliesMigration } from "@noldova/teamrun.core";

@TestClass
export class MigrationCatalogTests {
  @TestMethod
  public startsWithTheInitialSchemaAndEndsWithTheTeammateLastReplies(): void {
    Assert.areEqual(30, MigrationCatalog.all.length);
    Assert.isInstanceOf(MigrationCatalog.all.at(-1), TeammateLastRepliesMigration);
    Assert.isInstanceOf(MigrationCatalog.all[0], InitialMigration);
    Assert.areEqual(Resources.initialMigrationId, MigrationCatalog.all[0]?.id);
  }
}
