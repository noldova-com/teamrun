/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestDataRow, TestMethod, TestMethodResultOptions } from "@noldova/teamrun-foundation-testing";

@TestClass
export class TestMethodResultOptionsTests {
  @TestMethod
  public leavesEveryOptionAbsentByDefault(): void {
    const options = new TestMethodResultOptions();

    Assert.isUndefined(options.testDataRow);
    Assert.isUndefined(options.failure);
    Assert.isUndefined(options.skipReason);
  }

  @TestMethod
  public carriesTheGivenOptions(): void {
    const testDataRow = new TestDataRow(1, ["value"]);
    const failure = new Error("boom");
    const options = new TestMethodResultOptions({ testDataRow, failure, skipReason: "pending" });

    Assert.areEqual<TestDataRow | undefined>(testDataRow, options.testDataRow);
    Assert.areEqual<unknown>(failure, options.failure);
    Assert.areEqual<string | undefined>("pending", options.skipReason);
  }

  @TestMethod
  public rejectsAnEmptySkipReason(): void {
    Assert.throws(() => new TestMethodResultOptions({ skipReason: " " }), ArgumentException);
  }
}
