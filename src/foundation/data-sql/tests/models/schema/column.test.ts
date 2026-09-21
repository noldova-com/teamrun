/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Column, ColumnType } from "@noldova/teamrun-foundation-data-sql";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class ColumnTests {
  @TestMethod
  public holdsADeclaration(): void {
    const column = new Column("title", ColumnType.Text, true);

    Assert.areEqual("title", column.name);
    Assert.areEqual(ColumnType.Text, column.type);
    Assert.isTrue(column.isNullable);
  }

  @TestMethod
  public rejectsABlankName(): void {
    Assert.areEqual("name", Assert.throws(() => new Column(" ", ColumnType.Integer, false), ArgumentException).parameterName);
  }
}
