/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestDataRow, TestMethod, TestMethodResult, TestMethodResultOptions, TestOutcome } from "@noldova/teamrun-foundation-testing";

@TestClass
export class TestMethodResultTests {
  @TestMethod
  public composesTheDisplayName(): void {
    const result = new TestMethodResult("TestPackage", "SampleTests", "behaves", TestOutcome.Passed, 1);

    Assert.areEqual("SampleTests.behaves", result.displayName);
    Assert.isUndefined(result.testDataRow);
    Assert.isUndefined(result.failure);
    Assert.isUndefined(result.skipReason);
  }

  @TestMethod
  public carriesTheCompleteResult(): void {
    const failure = new Error("boom");
    const result = new TestMethodResult("TestPackage", "SampleTests", "behaves", TestOutcome.Failed, 12, new TestMethodResultOptions({ failure }));

    Assert.areEqual("TestPackage", result.packageName);
    Assert.areEqual(TestOutcome.Failed, result.outcome);
    Assert.areEqual(12, result.durationMilliseconds);
    Assert.areEqual<unknown>(failure, result.failure);
    Assert.isUndefined(result.skipReason);
  }

  @TestMethod
  public carriesTheSkipReason(): void {
    const result = new TestMethodResult("TestPackage", "SampleTests", "waits", TestOutcome.Skipped, 0, new TestMethodResultOptions({ skipReason: "pending" }));

    Assert.areEqual<string | undefined>("pending", result.skipReason);
  }

  @TestMethod
  public carriesTheTestDataRowAndItsDisplayName(): void {
    const testDataRow = new TestDataRow(3, ["value"]);
    const result = new TestMethodResult("TestPackage", "SampleTests", "behaves", TestOutcome.Passed, 1, new TestMethodResultOptions({ testDataRow }));

    Assert.areEqual<TestDataRow | undefined>(testDataRow, result.testDataRow);
    Assert.areEqual("SampleTests.behaves[3]", result.displayName);
  }

  @TestMethod
  public rejectsAWhitespacePackageName(): void {
    Assert.throws(() => new TestMethodResult(" ", "SampleTests", "behaves", TestOutcome.Passed, 1), ArgumentException);
  }

  @TestMethod
  public rejectsAWhitespaceClassName(): void {
    Assert.throws(() => new TestMethodResult("TestPackage", " ", "behaves", TestOutcome.Passed, 1), ArgumentException);
  }

  @TestMethod
  public rejectsAWhitespaceMethodName(): void {
    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", " ", TestOutcome.Passed, 1), ArgumentException);
  }

  @TestMethod
  public rejectsANegativeDuration(): void {
    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", "behaves", TestOutcome.Passed, -1), ArgumentException);
  }

  @TestMethod
  public rejectsANonFiniteDuration(): void {
    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", "behaves", TestOutcome.Passed, Number.NaN), ArgumentException);
    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", "behaves", TestOutcome.Passed, Number.POSITIVE_INFINITY), ArgumentException);
  }

  @TestMethod
  public rejectsAPassedResultCarryingAFailure(): void {
    const options = new TestMethodResultOptions({ failure: new Error("boom") });

    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", "behaves", TestOutcome.Passed, 1, options), ArgumentException);
  }

  @TestMethod
  public rejectsASkippedResultWithoutAReason(): void {
    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", "waits", TestOutcome.Skipped, 0), ArgumentException);
  }

  @TestMethod
  public rejectsAPassedResultCarryingASkipReason(): void {
    const options = new TestMethodResultOptions({ skipReason: "pending" });

    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", "behaves", TestOutcome.Passed, 1, options), ArgumentException);
  }

  @TestMethod
  public rejectsAFailedResultCarryingASkipReason(): void {
    const options = new TestMethodResultOptions({ failure: new Error("boom"), skipReason: "pending" });

    Assert.throws(() => new TestMethodResult("TestPackage", "SampleTests", "behaves", TestOutcome.Failed, 1, options), ArgumentException);
  }
}
