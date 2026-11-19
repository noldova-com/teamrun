/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CheckpointFoldersMigration, InitialMigration, MigrationCatalog, Resources } from "@noldova/teamrun.core";

@TestClass
export class MigrationCatalogTests {
  @TestMethod
  public startsWithTheInitialSchemaAndEndsWithTheCheckpointFolders(): void {
    Assert.areEqual(27, MigrationCatalog.all.length);
    Assert.isInstanceOf(MigrationCatalog.all.at(-1), CheckpointFoldersMigration);
    Assert.isInstanceOf(MigrationCatalog.all[0], InitialMigration);
    Assert.areEqual(Resources.initialMigrationId, MigrationCatalog.all[0]?.id);
  }
}
