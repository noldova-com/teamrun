/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Column, ColumnType, ForeignKey, PrimaryKey, Table } from "@noldova/teamrun-foundation-data-sql";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class TableTests {
  private static readonly id: Column = new Column("id", ColumnType.Text, false);

  @TestMethod
  public holdsANameAndCopiesOfItsParts(): void {
    const columns = [TableTests.id];
    const foreignKeys = [new ForeignKey("ownerId", "owners", "id")];
    const table = new Table("notes", columns, new PrimaryKey(["id"]), foreignKeys);
    columns.length = 0;
    foreignKeys.length = 0;

    Assert.areEqual("notes", table.name);
    Assert.areEqual(1, table.columns.length);
    Assert.areEqual("id", table.primaryKey?.columns.join(","));
    Assert.areEqual(1, table.foreignKeys.length);
  }

  @TestMethod
  public allowsATableWithoutKeys(): void {
    const table = new Table("log", [TableTests.id], null, []);

    Assert.isNull(table.primaryKey);
    Assert.areEqual(0, table.foreignKeys.length);
  }

  @TestMethod
  public rejectsInvalidDeclarations(): void {
    Assert.areEqual("name", Assert.throws(() => new Table(" ", [TableTests.id], null, []), ArgumentException).parameterName);
    const noColumns = Assert.throws(() => new Table("notes", [], null, []), ArgumentException);
    Assert.areEqual("columns", noColumns.parameterName);
    Assert.isTrue(noColumns.message.includes("\"notes\""));
  }
}
