/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Column, ColumnType, CreateTableOperation, PrimaryKey, Table } from "@noldova/teamrun-foundation-data-sql";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { TestDialect } from "../../fixtures/test-dialect.fixture.js";

@TestClass
export class CreateTableOperationTests {
  @TestMethod
  public rendersTheTableInTheDialect(): void {
    const table = new Table("notes", [new Column("id", ColumnType.Text, false)], new PrimaryKey(["id"]), []);
    const operation = new CreateTableOperation(table);

    Assert.areEqual(table, operation.table);
    Assert.areEqual("CREATE TABLE notes (id TEXT NOT NULL, PRIMARY KEY (id))", operation.render(new TestDialect()));
  }
}
