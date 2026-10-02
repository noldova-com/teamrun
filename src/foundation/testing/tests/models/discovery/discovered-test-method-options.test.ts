/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, DiscoveredTestMethodOptions, TestClass, TestDataRow, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class DiscoveredTestMethodOptionsTests {
  @TestMethod
  public leavesEveryOptionAbsentByDefault(): void {
    const options = new DiscoveredTestMethodOptions();

    Assert.isUndefined(options.testDataRow);
    Assert.isUndefined(options.skipReason);
    Assert.areEqual(0, options.categories.length);
  }

  @TestMethod
  public carriesTheGivenOptions(): void {
    const testDataRow = new TestDataRow(0, ["value"]);
    const options = new DiscoveredTestMethodOptions({ testDataRow, skipReason: "pending", categories: ["first"] });

    Assert.areEqual<TestDataRow | undefined>(testDataRow, options.testDataRow);
    Assert.areEqual<string | undefined>("pending", options.skipReason);
    Assert.areEqual<string | undefined>("first", options.categories[0]);
  }

  @TestMethod
  public carriesDistinctCopiedCategories(): void {
    const categories = ["first", "second", "first"];
    const options = new DiscoveredTestMethodOptions({ categories });
    categories[0] = "changed";

    Assert.areEqual(2, options.categories.length);
    Assert.areEqual<string | undefined>("first", options.categories[0]);
    Assert.areEqual<string | undefined>("second", options.categories[1]);
  }

  @TestMethod
  public rejectsAnEmptySkipReason(): void {
    Assert.throws(() => new DiscoveredTestMethodOptions({ skipReason: " " }), ArgumentException);
  }

  @TestMethod
  public rejectsAnInvalidCategory(): void {
    Assert.throws(() => new DiscoveredTestMethodOptions({ categories: [" "] }), ArgumentException);
  }
}
