/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as api from "@noldova/teamrun-foundation-data";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class DataApiTests {
  @TestMethod
  public exportsTheCompleteRuntimeSurface(): void {
    const expected = [
      "Change", "ChangeFeed", "ChangeOperation", "Connection", "DataException", "DataProvider", "DataRecord", "DataSource", "DatabaseFacade",
      "DbContext", "DbContextOptions", "DbContextOptionsBuilder", "Index", "Migration", "MigrationHistory", "Migrator", "Query", "Transaction"
    ];

    Assert.areEqual(expected.join(","), Object.keys(api).sort().join(","));
  }
}
