/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestClassResult, TestMethod, TestMethodResult, TestOutcome } from "@noldova/teamrun-foundation-testing";

@TestClass
export class TestClassResultTests {
  @TestMethod
  public carriesTheCompleteResult(): void {
    const methodResult = new TestMethodResult("TestPackage", "SampleTests", "behaves", undefined, [], TestOutcome.Passed, 1, undefined, undefined);
    const result = new TestClassResult("TestPackage", "SampleTests", "sample.test.js", [methodResult]);

    Assert.areEqual("TestPackage", result.packageName);
    Assert.areEqual("SampleTests", result.className);
    Assert.areEqual("sample.test.js", result.filePath);
    Assert.areEqual(1, result.methodResults.length);
  }

  @TestMethod
  public rejectsAWhitespacePackageName(): void {
    Assert.throws(() => new TestClassResult(" ", "SampleTests", "sample.test.js", []), ArgumentException);
  }

  @TestMethod
  public rejectsAWhitespaceClassName(): void {
    Assert.throws(() => new TestClassResult("TestPackage", " ", "sample.test.js", []), ArgumentException);
  }

  @TestMethod
  public rejectsAWhitespaceFilePath(): void {
    Assert.throws(() => new TestClassResult("TestPackage", "SampleTests", " ", []), ArgumentException);
  }

  @TestMethod
  public rejectsAnEmptyMethodResultCollection(): void {
    Assert.throws(() => new TestClassResult("TestPackage", "SampleTests", "sample.test.js", []), ArgumentException);
  }

  @TestMethod
  public rejectsAMethodResultFromAnotherClass(): void {
    const methodResult = new TestMethodResult("TestPackage", "OtherTests", "behaves", undefined, [], TestOutcome.Passed, 1, undefined, undefined);

    Assert.throws(() => new TestClassResult("TestPackage", "SampleTests", "sample.test.js", [methodResult]), ArgumentException);
  }

  @TestMethod
  public rejectsAMethodResultFromAnotherPackage(): void {
    const methodResult = new TestMethodResult("OtherPackage", "SampleTests", "behaves", undefined, [], TestOutcome.Passed, 1, undefined, undefined);

    Assert.throws(() => new TestClassResult("TestPackage", "SampleTests", "sample.test.js", [methodResult]), ArgumentException);
  }

  @TestMethod
  public copiesTheMethodResults(): void {
    const methodResults = [new TestMethodResult("TestPackage", "SampleTests", "behaves", undefined, [], TestOutcome.Passed, 1, undefined, undefined)];
    const result = new TestClassResult("TestPackage", "SampleTests", "sample.test.js", methodResults);
    methodResults.push(new TestMethodResult("TestPackage", "SampleTests", "alsoBehaves", undefined, [], TestOutcome.Passed, 1, undefined, undefined));

    Assert.areEqual(1, result.methodResults.length);
  }
}
