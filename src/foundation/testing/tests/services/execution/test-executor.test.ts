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
  DiscoveredTestClassOptions,
  DiscoveredTestMethod,
  DiscoveredTestMethodOptions,
  TestClass,
  TestDataRow,
  TestExecutor,
  TestingException,
  TestMethod,
  TestOutcome,
  TestTimeoutException
} from "@noldova/teamrun-foundation-testing";

import { ExecutionFixture } from "../../fixtures/execution/execution-fixture.fixture.js";
import { RecordingTestProgress } from "../../fixtures/execution/recording-test-progress.fixture.js";

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
    const testClass = new DiscoveredTestClass(
      "TestPackage",
      "ExecutionFixtureTests",
      "inline://fixture",
      ExecutionFixture,
      [
      new DiscoveredTestMethod("receivesData", new DiscoveredTestMethodOptions({ testDataRow: new TestDataRow(0, ["a", 1]) })),
      new DiscoveredTestMethod("receivesData", new DiscoveredTestMethodOptions({ testDataRow: new TestDataRow(1, ["second", 6]) })),
      new DiscoveredTestMethod("receivesDataAsync", new DiscoveredTestMethodOptions({ testDataRow: new TestDataRow(0, ["async"]) }))
    ]);
    const classResults = await new TestExecutor(1000).executeAsync([testClass]);
    const methodResults = classResults[0]?.methodResults ?? [];

    Assert.areEqual(3, methodResults.length);
    Assert.isTrue(methodResults.every(t => t.outcome === TestOutcome.Passed));
    Assert.areEqual<number | undefined>(0, methodResults[0]?.testDataRow?.index);
    Assert.areEqual<unknown>("a", methodResults[0]?.testDataRow?.values[0]);
    Assert.areEqual<number | undefined>(1, methodResults[1]?.testDataRow?.index);
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
    const testClass = this.discoveredClass(["hangs"]);
    const classResults = await new TestExecutor(100).executeAsync([testClass]);
    const methodResult = classResults[0]?.methodResults[0];

    Assert.isDefined(methodResult);
    Assert.areEqual(TestOutcome.Failed, methodResult.outcome);
    Assert.isInstanceOf(methodResult.failure, TestTimeoutException);
  }

  @TestMethod
  public async reportsANonCallableMethodAsAFrameworkFailure(): Promise<void> {
    const testClass = this.discoveredClass(["missing"]);
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
      [new DiscoveredTestMethod("increments", new DiscoveredTestMethodOptions({ skipReason: "pending" }))]);
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
    const testClass = new DiscoveredTestClass(
      "TestPackage",
      "ExecutionFixtureTests",
      "inline://fixture",
      ExecutionFixture,
      [
      new DiscoveredTestMethod("receivesData", new DiscoveredTestMethodOptions({ testDataRow: new TestDataRow(0, ["value", 5]), skipReason: "pending" }))
    ]);
    const classResults = await new TestExecutor(1000).executeAsync([testClass]);
    const methodResult = classResults[0]?.methodResults[0];

    Assert.isDefined(methodResult);
    Assert.areEqual(TestOutcome.Skipped, methodResult.outcome);
    Assert.areEqual("ExecutionFixtureTests.receivesData[0]", methodResult.displayName);
  }

  @TestMethod
  public async skipsEveryMethodOfASkippedClass(): Promise<void> {
    const testClass = this.discoveredClass(["increments", "failsOnAssertion"], new DiscoveredTestClassOptions({ skipReason: "the fixture is pending" }));
    const classResults = await new TestExecutor(1000).executeAsync([testClass]);

    Assert.isTrue(classResults[0]?.methodResults.every(t => t.outcome === TestOutcome.Skipped) ?? false);
  }

  @TestMethod
  public async carriesTheAssertionFailure(): Promise<void> {
    const testClass = this.discoveredClass(["failsOnAssertion"]);
    const classResults = await new TestExecutor(1000).executeAsync([testClass]);

    Assert.isInstanceOf(classResults[0]?.methodResults[0]?.failure, AssertFailedException);
  }

  @TestMethod
  public async reportsEachClassBeforeProceedingToTheNext(): Promise<void> {
    const progress = new RecordingTestProgress();
    const first = new DiscoveredTestClass(
      "Package",
      "FirstTests",
      "first.test.js",
      ExecutionFixture,
      [new DiscoveredTestMethod("recordsExecution", new DiscoveredTestMethodOptions({ testDataRow: new TestDataRow(0, [progress.events, "first"]) }))]);
    const second = new DiscoveredTestClass(
      "Package",
      "SecondTests",
      "second.test.js",
      ExecutionFixture,
      [new DiscoveredTestMethod("recordsExecution", new DiscoveredTestMethodOptions({ testDataRow: new TestDataRow(0, [progress.events, "second"]) })),
      new DiscoveredTestMethod("failsOnAssertion")]);
    const results = await new TestExecutor(1000).executeAsync([first, second], progress);

    Assert.areEqual("run:first,complete:first.test.js,run:second,complete:second.test.js", progress.events.join(","));
    Assert.areEqual(results[0], progress.results[0]);
    Assert.areEqual(TestOutcome.Failed, progress.results[1]?.methodResults[1]?.outcome);
  }

  @TestMethod
  public async propagatesProgressFailuresAndRemovesItsRejectionListener(): Promise<void> {
    const testClass = this.discoveredClass(["increments"]);
    const before = process.listenerCount("unhandledRejection");
    const completed = new RecordingTestProgress();
    completed.completionFailure = new Error("completion output failed");
    Assert.areEqual(completed.completionFailure, await Assert.throwsAsync(() => new TestExecutor(1000).executeAsync([testClass], completed), Error));
    Assert.areEqual(before, process.listenerCount("unhandledRejection"));
  }

  private discoveredClass(methodNames: readonly string[], options: DiscoveredTestClassOptions = new DiscoveredTestClassOptions()): DiscoveredTestClass {
    return new DiscoveredTestClass(
      "TestPackage",
      "ExecutionFixtureTests",
      "inline://fixture",
      ExecutionFixture,
      methodNames.map(t => new DiscoveredTestMethod(t)),
      options);
  }

  private async executeAsync(methodNames: readonly string[]): Promise<Map<string, TestOutcome>> {
    const classResults = await new TestExecutor(5000).executeAsync([this.discoveredClass(methodNames)]);
    const outcomes = new Map<string, TestOutcome>();
    for (const classResult of classResults)
      for (const methodResult of classResult.methodResults)
        outcomes.set(methodResult.methodName, methodResult.outcome);

    return outcomes;
  }
}
