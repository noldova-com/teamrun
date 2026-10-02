/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestData, TestDataRow, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class TestDataRowTests {
  @TestMethod
  public carriesTheIndexAndCopiedValues(): void {
    const values = ["value", 2];
    const row = new TestDataRow(3, values);
    values[0] = "changed";

    Assert.areEqual(3, row.index);
    Assert.areEqual(2, row.values.length);
    Assert.areEqual<unknown>("value", row.values[0]);
  }

  @TestMethod
  @TestData(-1)
  @TestData(1.5)
  public rejectsAnInvalidIndex(index: number): void {
    Assert.throws(() => new TestDataRow(index, ["value"]), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsEmptyValues(): void {
    Assert.throws(() => new TestDataRow(0, []), ArgumentException);
  }
}
