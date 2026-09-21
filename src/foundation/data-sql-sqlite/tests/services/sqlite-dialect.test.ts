/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType } from "@noldova/teamrun-foundation-data-sql";
import { SQLiteDialect } from "@noldova/teamrun-foundation-data-sql-sqlite";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class SQLiteDialectTests {
  @TestMethod
  public spellsColumnTypes(): void {
    const dialect = new SQLiteDialect();

    Assert.areEqual("TEXT", dialect.formatColumnType(ColumnType.Text));
    Assert.areEqual("INTEGER", dialect.formatColumnType(ColumnType.Integer));
  }
}
