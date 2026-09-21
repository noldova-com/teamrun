/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Assert,
  DiscoveredTestClass,
  DiscoveredTestMethod,
  TestClass,
  TestExecutor,
  TestingException,
  TestMethod,
  TestOutcome,
  TestReportWriter,
  TestRunner,
} from "@noldova/teamrun-foundation-testing";

import { ExecutionFixture } from "../../fixtures/execution/execution-fixture.fixture.js";
import { LossyExecutor } from "../../fixtures/execution/lossy-executor.fixture.js";
import { QuietFixture } from "../../fixtures/execution/quiet-fixture.fixture.js";
import { RecordingTestProgress } from "../../fixtures/execution/recording-test-progress.fixture.js";
import { StubDiscovery } from "../../fixtures/execution/stub-discovery.fixture.js";

@TestClass
export class TestRunnerTests {
  @TestMethod
  public async runsEverythingWithoutAFilter(): Promise<void> {
    const result = await this.runner().runAsync([]);

    Assert.areEqual(4, result.total);
    Assert.areEqual(0, result.failed);
  }

  @TestMethod
  public async reportsOnlySelectedClasses(): Promise<void> {
    const progress = new RecordingTestProgress();
    const result = await this.runner().runAsync([], ["Alpha"], progress);

    Assert.areEqual(2, result.total);
    Assert.areEqual(1, progress.results.length);
    Assert.areEqual(1, progress.events.length);
    Assert.isTrue(progress.results.every(t => t.className.includes("Alpha")));
  }

  @TestMethod
  public async filtersByClassNameSubstring(): Promise<void> {
    const result = await this.runner().runAsync([], ["Alpha"]);

    Assert.areEqual(2, result.total);
  }

  @TestMethod
  public async filtersByMethodNameSubstring(): Promise<void> {
    const result = await this.runner().runAsync([], ["BetaFixtureTests.first"]);

    Assert.areEqual(1, result.total);
  }

  @TestMethod
  public async filtersByTestDataIndex(): Promise<void> {
    const testClass = new DiscoveredTestClass("TestPackage", "DataFixtureTests", "inline://data", QuietFixture, undefined, [
      new DiscoveredTestMethod("first", 0, ["first"], undefined),
      new DiscoveredTestMethod("first", 1, ["second"], undefined),
    ]);
    const runner = new TestRunner(new StubDiscovery([testClass]), new TestExecutor(5000));
    const result = await runner.runAsync([], ["DataFixtureTests.first[1]"]);

    Assert.areEqual(1, result.total);
    Assert.areEqual<number | undefined>(1, result.classResults[0]?.methodResults[0]?.testDataIndex);
  }

  @TestMethod
  public async filtersByPackageNameSubstring(): Promise<void> {
    const result = await this.runner().runAsync([], ["TestPackage"]);

    Assert.areEqual(4, result.total);
  }

  @TestMethod
  public async filtersByFilePathSubstring(): Promise<void> {
    const result = await this.runner().runAsync([], ["inline://fixture"]);

    Assert.areEqual(4, result.total);
  }

  @TestMethod
  public async selectsNothingForAForeignFilter(): Promise<void> {
    const result = await this.runner().runAsync([], ["Missing"]);

    Assert.areEqual(0, result.total);
  }

  @TestMethod
  public async combinesMultipleFiltersWithOrSemantics(): Promise<void> {
    const result = await this.runner().runAsync([], ["AlphaFixtureTests.first", "BetaFixtureTests.second"]);

    Assert.areEqual(2, result.total);
    Assert.isTrue(result.classResults.some(t => t.className === "AlphaFixtureTests" && t.methodResults[0]?.methodName === "first"));
    Assert.isTrue(result.classResults.some(t => t.className === "BetaFixtureTests" && t.methodResults[0]?.methodName === "second"));
  }

  @TestMethod
  public async filtersByExactClassCategory(): Promise<void> {
    const testClass = this.discoveredClass("CategorizedFixtureTests", ["conformance"]);
    const runner = new TestRunner(new StubDiscovery([testClass]), new TestExecutor(5000));
    const result = await runner.runAsync([], ["category:conformance"]);

    Assert.areEqual(2, result.total);
  }

  @TestMethod
  public async filtersByExactMethodCategory(): Promise<void> {
    const testClass = new DiscoveredTestClass("TestPackage", "CategorizedFixtureTests", "inline://fixture", QuietFixture, undefined, [
      new DiscoveredTestMethod("first", undefined, [], undefined, ["first-category"]),
      new DiscoveredTestMethod("second", undefined, [], undefined, ["second-category"]),
    ]);
    const runner = new TestRunner(new StubDiscovery([testClass]), new TestExecutor(5000));
    const result = await runner.runAsync([], ["category:second-category"]);

    Assert.areEqual(1, result.total);
    Assert.areEqual<string | undefined>("second", result.classResults[0]?.methodResults[0]?.methodName);
  }

  @TestMethod
  public async doesNotUseCategorySubstringMatching(): Promise<void> {
    const testClass = this.discoveredClass("CategorizedFixtureTests", ["conformance-extended"]);
    const runner = new TestRunner(new StubDiscovery([testClass]), new TestExecutor(5000));
    const result = await runner.runAsync([], ["category:conformance"]);

    Assert.areEqual(0, result.total);
  }

  @TestMethod
  public async failsWhenResultsDoNotReconcileWithDiscovery(): Promise<void> {
    const runner = new TestRunner(new StubDiscovery([this.discoveredClass("AlphaFixtureTests")]), new LossyExecutor(1000));

    await Assert.throwsAsync(async () => {
      await runner.runAsync([]);
    }, TestingException);
  }

  @TestMethod
  public async classifiesAndReportsEveryRequiredNegativeFixture(): Promise<void> {
    const testClass = new DiscoveredTestClass("TestPackage", "ExecutionFixtureTests", "inline://negative-fixture", ExecutionFixture, undefined, [
      new DiscoveredTestMethod("failsOnAssertion", undefined, [], undefined),
      new DiscoveredTestMethod("throwsAnError", undefined, [], undefined),
      new DiscoveredTestMethod("rejects", undefined, [], undefined),
      new DiscoveredTestMethod("hangs", undefined, [], undefined),
      new DiscoveredTestMethod("increments", undefined, [], "deliberately skipped"),
    ]);
    const result = await new TestRunner(new StubDiscovery([testClass]), new TestExecutor(100)).runAsync([]);
    const methods = result.classResults[0]?.methodResults ?? [];
    const report = new TestReportWriter().formatLines(result, false).join("\n");

    Assert.areEqual(TestOutcome.Failed, methods.find(t => t.methodName === "failsOnAssertion")?.outcome);
    Assert.areEqual(TestOutcome.Failed, methods.find(t => t.methodName === "throwsAnError")?.outcome);
    Assert.areEqual(TestOutcome.Failed, methods.find(t => t.methodName === "rejects")?.outcome);
    Assert.areEqual(TestOutcome.Failed, methods.find(t => t.methodName === "hangs")?.outcome);
    Assert.areEqual(TestOutcome.Skipped, methods.find(t => t.methodName === "increments")?.outcome);
    Assert.isTrue(report.includes("AssertFailedException"));
    Assert.isTrue(report.includes("Error: boom"));
    Assert.isTrue(report.includes("Error: rejected"));
    Assert.isTrue(report.includes("TestTimeoutException"));
    Assert.isTrue(report.includes("skipped: deliberately skipped"));
  }

  private runner(): TestRunner {
    const discovery = new StubDiscovery([this.discoveredClass("AlphaFixtureTests"), this.discoveredClass("BetaFixtureTests")]);

    return new TestRunner(discovery, new TestExecutor(5000));
  }

  private discoveredClass(className: string, categories: readonly string[] = []): DiscoveredTestClass {
    return new DiscoveredTestClass("TestPackage", className, "inline://fixture", QuietFixture, undefined, [
      new DiscoveredTestMethod("first", undefined, [], undefined),
      new DiscoveredTestMethod("second", undefined, [], undefined),
    ], categories);
  }
}
