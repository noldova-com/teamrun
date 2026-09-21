/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, Category, Skip, TestClass, TestData, TestDiscovery, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class TestMarksTests {
  @TestMethod
  public stampsAUniqueCategoryMark(): void {
    class Sample { }
    Category("sample")(Sample);
    const symbols = Object.getOwnPropertySymbols(Sample);

    Assert.areEqual(1, symbols.length);
    Assert.areEqual<string | undefined>("Noldova.Context.Testing.Category", symbols[0]?.description);
  }

  @TestMethod
  public stampsAUniqueClassMark(): void {
    class Sample { }
    TestClass(Sample);
    const symbols = Object.getOwnPropertySymbols(Sample);

    Assert.areEqual(1, symbols.length);
    Assert.areEqual<string | undefined>("Noldova.Context.Testing.TestClass", symbols[0]?.description);
  }

  @TestMethod
  public stampsAUniqueMethodMark(): void {
    const sample = (): void => { };
    TestMethod(sample);
    const symbols = Object.getOwnPropertySymbols(sample);

    Assert.areEqual(1, symbols.length);
    Assert.areEqual<string | undefined>("Noldova.Context.Testing.TestMethod", symbols[0]?.description);
  }

  @TestMethod
  public stampsAUniqueTestDataMark(): void {
    const sample = (): void => { };
    TestData("value")(sample);
    const symbols = Object.getOwnPropertySymbols(sample);

    Assert.areEqual(1, symbols.length);
    Assert.areEqual<string | undefined>("Noldova.Context.Testing.TestData", symbols[0]?.description);
  }

  @TestMethod
  public stampsTheSkipMarkWithItsReason(): void {
    @TestClass
    class SampleTests {
      @Skip("pending")
      @TestMethod
      public sample(): void { }
    }

    const testClass = new TestDiscovery().discoverModuleExports({ SampleTests }, "sample.test.js", "Sample")[0];
    const method = testClass?.methods[0];
    Assert.isDefined(method);
    Assert.areEqual<string | undefined>("pending", method.skipReason);
  }

  @TestMethod
  public keepsTheMarksDistinct(): void {
    class Sample { }
    Category("sample")(Sample);
    TestClass(Sample);
    Skip("pending")(Sample);

    Assert.areEqual(3, Object.getOwnPropertySymbols(Sample).length);
  }
}
