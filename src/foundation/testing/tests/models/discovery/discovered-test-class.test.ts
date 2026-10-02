/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, DiscoveredTestClass, DiscoveredTestClassOptions, DiscoveredTestMethod, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { SampleFixture } from "../../fixtures/discovery/sample-fixture.fixture.js";

@TestClass
export class DiscoveredTestClassTests {
  @TestMethod
  public carriesTheCompleteDiscovery(): void {
    const methods = [new DiscoveredTestMethod("behaves")];
    const options = new DiscoveredTestClassOptions({ skipReason: "pending", categories: ["first"] });
    const testClass = new DiscoveredTestClass("TestPackage", "SampleFixtureTests", "sample.test.js", SampleFixture, methods, options);

    Assert.areEqual("TestPackage", testClass.packageName);
    Assert.areEqual("SampleFixtureTests", testClass.className);
    Assert.areEqual("sample.test.js", testClass.filePath);
    Assert.areEqual<Function>(SampleFixture, testClass.testClassConstructor);
    Assert.areEqual(1, testClass.methods.length);
    Assert.areEqual<string | undefined>("pending", testClass.skipReason);
    Assert.areEqual<string | undefined>("first", testClass.categories[0]);
  }

  @TestMethod
  public leavesTheOptionsAbsentWithoutThem(): void {
    const testClass = new DiscoveredTestClass("TestPackage", "SampleFixtureTests", "sample.test.js", SampleFixture, [new DiscoveredTestMethod("behaves")]);

    Assert.isUndefined(testClass.skipReason);
    Assert.areEqual(0, testClass.categories.length);
  }

  @TestMethod
  public rejectsAnEmptyMethodCollection(): void {
    Assert.throws(() => new DiscoveredTestClass("TestPackage", "SampleFixtureTests", "sample.test.js", SampleFixture, []), ArgumentException);
  }

  @TestMethod
  public copiesTheMethods(): void {
    const methods = [new DiscoveredTestMethod("behaves")];
    const testClass = new DiscoveredTestClass("TestPackage", "SampleFixtureTests", "sample.test.js", SampleFixture, methods);
    methods.push(new DiscoveredTestMethod("alsoBehaves"));

    Assert.areEqual(1, testClass.methods.length);
  }
}
