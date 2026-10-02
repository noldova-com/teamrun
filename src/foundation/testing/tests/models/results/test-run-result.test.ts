/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestClassResult, TestMethod, TestMethodResult, TestMethodResultOptions, TestOutcome, TestRunResult } from "@noldova/teamrun-foundation-testing";

@TestClass
export class TestRunResultTests {
  @TestMethod
  public computesTheTotalsAcrossClasses(): void {
    const result = new TestRunResult([
      new TestClassResult("TestPackage", "FirstTests", "first.test.js", [
        new TestMethodResult("TestPackage", "FirstTests", "passes", TestOutcome.Passed, 1),
        new TestMethodResult("TestPackage", "FirstTests", "fails", TestOutcome.Failed, 1, new TestMethodResultOptions({ failure: new Error("boom") }))
      ]),
      new TestClassResult("TestPackage", "SecondTests", "second.test.js", [
        new TestMethodResult("TestPackage", "SecondTests", "skips", TestOutcome.Skipped, 0, new TestMethodResultOptions({ skipReason: "pending" })),
        new TestMethodResult("TestPackage", "SecondTests", "passes", TestOutcome.Passed, 1)
      ])
    ]);

    Assert.areEqual(2, result.passed);
    Assert.areEqual(1, result.failed);
    Assert.areEqual(1, result.skipped);
    Assert.areEqual(3, result.durationMilliseconds);
    Assert.areEqual(3, result.executed);
    Assert.areEqual(4, result.total);
  }

  @TestMethod
  public isEmptyForNoResults(): void {
    const result = new TestRunResult([]);

    Assert.areEqual(0, result.total);
    Assert.areEqual(0, result.durationMilliseconds);
  }

  @TestMethod
  public copiesTheClassResults(): void {
    const classResults = [new TestClassResult("TestPackage", "FirstTests", "first.test.js", [
      new TestMethodResult("TestPackage", "FirstTests", "passes", TestOutcome.Passed, 1)
    ])];
    const result = new TestRunResult(classResults);
    classResults.push(new TestClassResult("TestPackage", "SecondTests", "second.test.js", [
      new TestMethodResult("TestPackage", "SecondTests", "passes", TestOutcome.Passed, 1)
    ]));

    Assert.areEqual(1, result.classResults.length);
  }
}
