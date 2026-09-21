/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestData, TestingException, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class TestDataDecoratorTests {
  @TestMethod
  @TestData("first", 1)
  @TestData("second", 2)
  public suppliesInlineArguments(name: string, value: number): void {
    Assert.areEqual(name.length, value + 4);
  }

  @TestMethod
  public rejectsAnEmptyDataRow(): void {
    Assert.throws(() => {
      TestData();
    }, ArgumentException);
  }

  @TestMethod
  public rejectsACorruptExistingMark(): void {
    const sample = (): void => { };
    const marked = (): void => { };
    TestData("valid")(marked);
    const testDataMark = Object.getOwnPropertySymbols(marked)[0];
    Assert.isDefined(testDataMark);
    Object.defineProperty(sample, testDataMark, { value: 1 });

    Assert.throws(() => {
      TestData("invalid")(sample);
    }, TestingException);
  }
}
