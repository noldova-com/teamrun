/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as api from "@noldova/teamrun-foundation-data-sql";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class DataSqlApiTests {
  @TestMethod
  public exportsTheCompleteRuntimeSurface(): void {
    const expected = [
      "Column", "ColumnBuilder", "ColumnType", "ColumnsBuilder", "ConstraintsBuilder", "CreateIndexOperation", "CreateTableOperation", "ForeignKey",
      "MigrationBuilder", "PrimaryKey", "SchemaOperation", "SqlChangeFeed", "SqlConnection", "SqlDialect", "SqlMigration", "SqlMigrationHistory",
      "SqlMigrator", "SqlProvider", "SqlQuery", "SqlTransaction", "Table"
    ];

    Assert.areEqual(expected.join(","), Object.keys(api).sort().join(","));
  }
}
