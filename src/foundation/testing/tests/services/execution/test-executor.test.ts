/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import {
  Assert,
  AssertFailedException,
  DiscoveredTestClass,
  DiscoveredTestMethod,
  TestClass,
  TestExecutor,
  TestingException,
  TestMethod,
  TestOutcome,
  TestTimeoutException,
} from "@noldova/teamrun-foundation-testing";

import { ExecutionFixture } from "../../fixtures/execution/execution-fixture.fixture.js";

@TestClass
export class TestExecutorTests {
  @TestMethod
  public rejectsANonPositiveTimeout(): void {
    Assert.throws(() => {
      new TestExecutor(0);
    }, ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsAFractionalTimeout(): void {
    Assert.throws(() => {
      new TestExecutor(10.5);
    }, ArgumentOutOfRangeException);
  }

  @TestMethod
  public async executesEveryMethodOnAFreshInstance(): Promise<void> {
    const results = await this.executeAsync(["increments", "incrementsAgain"]);

    Assert.areEqual(TestOutcome.Passed, results.get("increments"));
    Assert.areEqual(TestOutcome.Passed, results.get("incrementsAgain"));
  }

  @TestMethod
  public async executesEveryDataRowIndependentlyOnAFreshInstance(): Promise<void> {
    const testClass = new DiscoveredTestClass("TestPackage", "ExecutionFixtureTests", "inline://fixture", ExecutionFixture, undefined, [
      new DiscoveredTestMethod("receivesData", 0, ["a", 1], undefined),
      new DiscoveredTestMethod("receivesData", 1, ["second", 6], undefined),
      new DiscoveredTestMethod("receivesDataAsync", 0, ["async"], undefined),
    ]);
    const classResults = await new TestExecutor(1000).executeAsync([testClass]);
    const methodResults = classResults[0]?.methodResults ?? [];

    Assert.areEqual(3, methodResults.length);
    Assert.isTrue(methodResults.every(t => t.outcome === TestOutcome.Passed));
    Assert.areEqual<number | undefined>(0, methodResults[0]?.testDataIndex);
    Assert.areEqual<unknown>("a", methodResults[0]?.testData[0]);
    Assert.areEqual<number | undefined>(1, methodResults[1]?.testDataIndex);
  }

  @TestMethod
  public async classifiesFailuresAndAsynchronousWork(): Promise<void> {
    const results = await this.executeAsync(["failsOnAssertion", "throwsAnError", "resolvesLater", "rejects"]);

    Assert.areEqual(TestOutcome.Failed, results.get("failsOnAssertion"));
    Assert.areEqual(TestOutcome.Failed, results.get("throwsAnError"));
    Assert.areEqual(TestOutcome.Passed, results.get("resolvesLater"));
    Assert.areEqual(TestOutcome.Failed, results.get("rejects"));
  }

  @TestMethod
  public async attributesAStrayRejectionToItsTest(): Promise<void> {
    const results = await this.executeAsync(["leavesAStrayRejection"]);

    Assert.areEqual(TestOutcome.Failed, results.get("leavesAStrayRejection"));
  }

  @TestMethod
  public rejectsAnUnhandledRejectionOutsideTestExecution(): void {
    const failure = new Error("outside");

    Assert.areEqual(failure, Assert.throws(() => {
      new ExecutionFixture().emitUnhandledRejectionOutsideTestExecution(failure);
    }, Error));
  }

  @TestMethod
  public async failsAHangingTestThroughTheTimeout(): Promise<void> {
    const testClass = this.discoveredClass(["hangs"], undefined);
    const classResults = await new TestExecutor(100).executeAsync([testClass]);
    const methodResult = classResults[0]?.methodResults[0];

    Assert.isDefined(methodResult);
    Assert.areEqual(TestOutcome.Failed, methodResult.outcome);
    Assert.isInstanceOf(methodResult.failure, TestTimeoutException);
  }

  @TestMethod
  public async reportsANonCallableMethodAsAFrameworkFailure(): Promise<void> {
    const testClass = this.discoveredClass(["missing"], undefined);
    const classResults = await new TestExecutor(1000).executeAsync([testClass]);
    const methodResult = classResults[0]?.methodResults[0];

    Assert.isDefined(methodResult);
    Assert.areEqual(TestOutcome.Failed, methodResult.outcome);
    Assert.isInstanceOf(methodResult.failure, TestingException);
  }

  @TestMethod
  public async skipsAMethodWithAReason(): Promise<void> {
    const testClass = new DiscoveredTestClass(
      "TestPackage",
      "ExecutionFixtureTests",
      "inline://fixture",
      ExecutionFixture,
      undefined,
      [new DiscoveredTestMethod("increments", undefined, [], "pending")]);
    const classResults = await new TestExecutor(1000).executeAsync([testClass]);
    const methodResult = classResults[0]?.methodResults[0];

    Assert.isDefined(methodResult);
    Assert.areEqual(TestOutcome.Skipped, methodResult.outcome);
    Assert.areEqual<string | undefined>("pending", methodResult.skipReason);
    Assert.areEqual<string | undefined>("TestPackage", methodResult.packageName);
    Assert.areEqual<string | undefined>("TestPackage", classResults[0]?.packageName);
  }

  @TestMethod
  public async skipsADataRowWithItsIdentity(): Promise<void> {
    const testClass = new DiscoveredTestClass("TestPackage", "ExecutionFixtureTests", "inline://fixture", ExecutionFixture, undefined, [
      new DiscoveredTestMethod("receivesData", 0, ["value", 5], "pending"),
    ]);
    const classResults = await new TestExecutor(1000).executeAsync([testClass]);
    const methodResult = classResults[0]?.methodResults[0];

    Assert.isDefined(methodResult);
    Assert.areEqual(TestOutcome.Skipped, methodResult.outcome);
    Assert.areEqual("ExecutionFixtureTests.receivesData[0]", methodResult.displayName);
  }

  @TestMethod
  public async skipsEveryMethodOfASkippedClass(): Promise<void> {
    const testClass = this.discoveredClass(["increments", "failsOnAssertion"], "the fixture is pending");
    const classResults = await new TestExecutor(1000).executeAsync([testClass]);

    Assert.isTrue(classResults[0]?.methodResults.every(t => t.outcome === TestOutcome.Skipped) ?? false);
  }

  @TestMethod
  public async carriesTheAssertionFailure(): Promise<void> {
    const testClass = this.discoveredClass(["failsOnAssertion"], undefined);
    const classResults = await new TestExecutor(1000).executeAsync([testClass]);

    Assert.isInstanceOf(classResults[0]?.methodResults[0]?.failure, AssertFailedException);
  }

  private discoveredClass(methodNames: readonly string[], skipReason: string | undefined): DiscoveredTestClass {
    return new DiscoveredTestClass(
      "TestPackage",
      "ExecutionFixtureTests",
      "inline://fixture",
      ExecutionFixture,
      skipReason,
      methodNames.map(t => new DiscoveredTestMethod(t, undefined, [], undefined)));
  }

  private async executeAsync(methodNames: readonly string[]): Promise<Map<string, TestOutcome>> {
    const classResults = await new TestExecutor(5000).executeAsync([this.discoveredClass(methodNames, undefined)]);
    const outcomes = new Map<string, TestOutcome>();
    for (const classResult of classResults)
      for (const methodResult of classResult.methodResults)
        outcomes.set(methodResult.methodName, methodResult.outcome);

    return outcomes;
  }
}
