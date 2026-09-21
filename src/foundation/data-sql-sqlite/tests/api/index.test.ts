/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as api from "@noldova/teamrun-foundation-data-sql-sqlite";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class DataSqlSQLiteApiTests {
  @TestMethod
  public exportsTheCompleteRuntimeSurface(): void {
    Assert.areEqual("SQLiteConnection,SQLiteDialect,SQLiteProvider", Object.keys(api).sort().join(","));
  }
}
