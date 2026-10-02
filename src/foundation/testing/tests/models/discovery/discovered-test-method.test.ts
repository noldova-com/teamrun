/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, DiscoveredTestMethod, DiscoveredTestMethodOptions, TestClass, TestDataRow, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class DiscoveredTestMethodTests {
  @TestMethod
  public carriesTheMethodNameWithoutOptions(): void {
    const method = new DiscoveredTestMethod("behaves");

    Assert.areEqual("behaves", method.methodName);
    Assert.isUndefined(method.testDataRow);
    Assert.isUndefined(method.skipReason);
    Assert.areEqual(0, method.categories.length);
    Assert.areEqual("behaves", method.displayName);
  }

  @TestMethod
  public carriesTheSkipReason(): void {
    Assert.areEqual<string | undefined>("pending", new DiscoveredTestMethod("behaves", new DiscoveredTestMethodOptions({ skipReason: "pending" })).skipReason);
  }

  @TestMethod
  public carriesTheTestDataRowAndItsDisplayName(): void {
    const testDataRow = new TestDataRow(2, ["value"]);
    const method = new DiscoveredTestMethod("behaves", new DiscoveredTestMethodOptions({ testDataRow }));

    Assert.areEqual<TestDataRow | undefined>(testDataRow, method.testDataRow);
    Assert.areEqual("behaves[2]", method.displayName);
  }

  @TestMethod
  public carriesTheCategories(): void {
    const method = new DiscoveredTestMethod("behaves", new DiscoveredTestMethodOptions({ categories: ["first", "second"] }));

    Assert.areEqual(2, method.categories.length);
    Assert.areEqual<string | undefined>("second", method.categories[1]);
  }

  @TestMethod
  public rejectsAnEmptyMethodName(): void {
    Assert.throws(() => new DiscoveredTestMethod(" "), ArgumentException);
  }
}
