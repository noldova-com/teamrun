/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { InitialMigration, MigrationCatalog, Resources } from "@noldova/teamrun-core";

@TestClass
export class MigrationCatalogTests {
  @TestMethod
  public startsWithTheInitialSchema(): void {
    Assert.areEqual(2, MigrationCatalog.all.length);
    Assert.isInstanceOf(MigrationCatalog.all[0], InitialMigration);
    Assert.areEqual(Resources.initialMigrationId, MigrationCatalog.all[0]?.id);
  }
}
