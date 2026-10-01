/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, DiscoveredTestClass, DiscoveredTestMethod, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { SampleFixture } from "../../fixtures/discovery/sample-fixture.fixture.js";

@TestClass
export class DiscoveredTestClassTests {
  @TestMethod
  public carriesTheCompleteDiscovery(): void {
    const methods = [new DiscoveredTestMethod("behaves", undefined, [], undefined)];
    const testClass = new DiscoveredTestClass("TestPackage", "SampleFixtureTests", "sample.test.js", SampleFixture, "pending", methods);

    Assert.areEqual("TestPackage", testClass.packageName);
    Assert.areEqual("SampleFixtureTests", testClass.className);
    Assert.areEqual("sample.test.js", testClass.filePath);
    Assert.areEqual<Function>(SampleFixture, testClass.testClassConstructor);
    Assert.areEqual<string | undefined>("pending", testClass.skipReason);
    Assert.areEqual(1, testClass.methods.length);
  }

  @TestMethod
  public rejectsAnEmptyMethodCollection(): void {
    Assert.throws(() => new DiscoveredTestClass("TestPackage", "SampleFixtureTests", "sample.test.js", SampleFixture, undefined, []), ArgumentException);
  }

  @TestMethod
  public copiesTheMethods(): void {
    const methods = [new DiscoveredTestMethod("behaves", undefined, [], undefined)];
    const testClass = new DiscoveredTestClass("TestPackage", "SampleFixtureTests", "sample.test.js", SampleFixture, undefined, methods);
    methods.push(new DiscoveredTestMethod("alsoBehaves", undefined, [], undefined));

    Assert.areEqual(1, testClass.methods.length);
  }

  @TestMethod
  public carriesDistinctCopiedCategories(): void {
    const categories = ["first", "second", "first"];
    const methods = [new DiscoveredTestMethod("behaves", undefined, [], undefined)];
    const testClass = new DiscoveredTestClass("TestPackage", "SampleFixtureTests", "sample.test.js", SampleFixture, undefined, methods, categories);
    categories[0] = "changed";

    Assert.areEqual(2, testClass.categories.length);
    Assert.areEqual<string | undefined>("first", testClass.categories[0]);
    Assert.areEqual<string | undefined>("second", testClass.categories[1]);
  }

  @TestMethod
  public rejectsAnInvalidCategory(): void {
    const methods = [new DiscoveredTestMethod("behaves", undefined, [], undefined)];

    Assert.throws(() => new DiscoveredTestClass(
      "TestPackage",
      "SampleFixtureTests",
      "sample.test.js",
      SampleFixture,
      undefined,
      methods,
      [" "]), ArgumentException);
  }
}
