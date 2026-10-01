/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, DiscoveredTestMethod, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class DiscoveredTestMethodTests {
  @TestMethod
  public carriesTheMethodName(): void {
    const method = new DiscoveredTestMethod("behaves", undefined, [], undefined);

    Assert.areEqual("behaves", method.methodName);
    Assert.isUndefined(method.skipReason);
  }

  @TestMethod
  public carriesTheSkipReason(): void {
    Assert.areEqual<string | undefined>("pending", new DiscoveredTestMethod("behaves", undefined, [], "pending").skipReason);
  }

  @TestMethod
  public carriesTestDataAndItsDisplayName(): void {
    const testData = ["value"];
    const method = new DiscoveredTestMethod("behaves", 2, testData, undefined);
    testData[0] = "changed";

    Assert.areEqual<number | undefined>(2, method.testDataIndex);
    Assert.areEqual<unknown>("value", method.testData[0]);
    Assert.areEqual("behaves[2]", method.displayName);
  }

  @TestMethod
  public rejectsTestDataWithoutAnIndex(): void {
    Assert.throws(() => new DiscoveredTestMethod("behaves", undefined, ["value"], undefined), ArgumentException);
  }

  @TestMethod
  public rejectsAnIndexWithoutTestData(): void {
    Assert.throws(() => new DiscoveredTestMethod("behaves", 0, [], undefined), ArgumentException);
  }

  @TestMethod
  public rejectsAnInvalidTestDataIndex(): void {
    Assert.throws(() => new DiscoveredTestMethod("behaves", -1, ["value"], undefined), ArgumentOutOfRangeException);
    Assert.throws(() => new DiscoveredTestMethod("behaves", 1.5, ["value"], undefined), ArgumentOutOfRangeException);
  }

  @TestMethod
  public carriesDistinctCopiedCategories(): void {
    const categories = ["first", "second", "first"];
    const method = new DiscoveredTestMethod("behaves", undefined, [], undefined, categories);
    categories[0] = "changed";

    Assert.areEqual(2, method.categories.length);
    Assert.areEqual<string | undefined>("first", method.categories[0]);
    Assert.areEqual<string | undefined>("second", method.categories[1]);
  }

  @TestMethod
  public rejectsAnInvalidCategory(): void {
    Assert.throws(() => new DiscoveredTestMethod("behaves", undefined, [], undefined, [" "]), ArgumentException);
  }
}
