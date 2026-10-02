/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod, TestMethodResult, TestOutcome } from "@noldova/teamrun-foundation-testing";

@TestClass
export class TestMethodResultTests {
  @TestMethod
  public composesTheDisplayName(): void {
    const result = new TestMethodResult("TestPackage", "SampleTests", "behaves", undefined, [], TestOutcome.Passed, 1, undefined, undefined);

    Assert.areEqual("SampleTests.behaves", result.displayName);
  }

  @TestMethod
  public carriesTheCompleteResult(): void {
    const failure = new Error("boom");
    const result = new TestMethodResult("TestPackage", "SampleTests", "behaves", undefined, [], TestOutcome.Failed, 12, failure, undefined);

    Assert.areEqual("TestPackage", result.packageName);
    Assert.areEqual(TestOutcome.Failed, result.outcome);
    Assert.areEqual(12, result.durationMilliseconds);
    Assert.areEqual<unknown>(failure, result.failure);
    Assert.isUndefined(result.skipReason);
  }

  @TestMethod
  public carriesTheSkipReason(): void {
    const result = new TestMethodResult("TestPackage", "SampleTests", "waits", undefined, [], TestOutcome.Skipped, 0, undefined, "pending");

    Assert.areEqual<string | undefined>("pending", result.skipReason);
  }

  @TestMethod
  public carriesTestDataAndItsDisplayName(): void {
    const testData = ["value"];
    const result = new TestMethodResult("TestPackage", "SampleTests", "behaves", 3, testData, TestOutcome.Passed, 1, undefined, undefined);
    testData[0] = "changed";

    Assert.areEqual<number | undefined>(3, result.testDataIndex);
    Assert.areEqual<unknown>("value", result.testData[0]);
    Assert.areEqual("SampleTests.behaves[3]", result.displayName);
  }

  @TestMethod
  public rejectsTestDataWithoutAnIndex(): void {
    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", "behaves", undefined, ["value"], TestOutcome.Passed, 1, undefined, undefined), ArgumentException);
  }

  @TestMethod
  public rejectsAnIndexWithoutTestData(): void {
    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", "behaves", 0, [], TestOutcome.Passed, 1, undefined, undefined), ArgumentException);
  }

  @TestMethod
  public rejectsAnInvalidTestDataIndex(): void {
    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", "behaves", -1, ["value"], TestOutcome.Passed, 1, undefined, undefined), ArgumentException);
    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", "behaves", 1.5, ["value"], TestOutcome.Passed, 1, undefined, undefined), ArgumentException);
  }

  @TestMethod
  public rejectsAWhitespacePackageName(): void {
    Assert.throws(() => new TestMethodResult(" ", "SampleTests", "behaves", undefined, [], TestOutcome.Passed, 1, undefined, undefined), ArgumentException);
  }

  @TestMethod
  public rejectsAWhitespaceClassName(): void {
    Assert.throws(() => new TestMethodResult("TestPackage", " ", "behaves", undefined, [], TestOutcome.Passed, 1, undefined, undefined), ArgumentException);
  }

  @TestMethod
  public rejectsAWhitespaceMethodName(): void {
    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", " ", undefined, [], TestOutcome.Passed, 1, undefined, undefined), ArgumentException);
  }

  @TestMethod
  public rejectsANegativeDuration(): void {
    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", "behaves", undefined, [], TestOutcome.Passed, -1, undefined, undefined), ArgumentException);
  }

  @TestMethod
  public rejectsANonFiniteDuration(): void {
    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", "behaves", undefined, [], TestOutcome.Passed, Number.NaN, undefined, undefined), ArgumentException);
    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", "behaves", undefined, [], TestOutcome.Passed, Number.POSITIVE_INFINITY, undefined, undefined), ArgumentException);
  }

  @TestMethod
  public rejectsAPassedResultCarryingAFailure(): void {
    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", "behaves", undefined, [], TestOutcome.Passed, 1, new Error("boom"), undefined), ArgumentException);
  }

  @TestMethod
  public rejectsASkippedResultWithoutAReason(): void {
    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", "waits", undefined, [], TestOutcome.Skipped, 0, undefined, undefined), ArgumentException);
  }

  @TestMethod
  public rejectsAPassedResultCarryingASkipReason(): void {
    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", "behaves", undefined, [], TestOutcome.Passed, 1, undefined, "pending"), ArgumentException);
  }

  @TestMethod
  public rejectsAFailedResultCarryingASkipReason(): void {
    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", "behaves", undefined, [], TestOutcome.Failed, 1, new Error("boom"), "pending"), ArgumentException);
  }
}
