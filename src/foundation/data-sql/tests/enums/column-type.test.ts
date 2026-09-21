/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType } from "@noldova/teamrun-foundation-data-sql";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class ColumnTypeTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("Text", ColumnType.Text);
    Assert.areEqual("Integer", ColumnType.Integer);
    Assert.areEqual(2, Object.values(ColumnType).length);
  }
}
