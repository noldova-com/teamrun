/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, Category, TestClass, TestDiscovery, TestingException, TestMethod } from "@noldova/teamrun-foundation-testing";

@Category("Testing.Categories")
@TestClass
export class CategoryDecoratorTests {
  @TestMethod
  public preservesRepeatedCategoriesInWrittenOrder(): void {
    @Category("first")
    @Category("second")
    @TestClass
    class SampleTests {
      @TestMethod
      public sample(): void { }
    }

    const testClass = new TestDiscovery().discoverModuleExports({ SampleTests }, "sample.test.js", "Sample")[0];
    Assert.isDefined(testClass);
    Assert.areEqual("first", testClass.categories[0]);
    Assert.areEqual("second", testClass.categories[1]);
  }

  @TestMethod
  public rejectsAnEmptyCategory(): void {
    Assert.throws(() => {
      Category(String.empty);
    }, ArgumentException);
  }

  @TestMethod
  public rejectsAWhitespaceCategory(): void {
    Assert.throws(() => {
      Category("   ");
    }, ArgumentException);
  }

  @TestMethod
  public rejectsACorruptExistingMark(): void {
    class Marked { }
    class Sample { }
    Category("valid")(Marked);
    const categoryMark = Object.getOwnPropertySymbols(Marked)[0];
    Assert.isDefined(categoryMark);
    Object.defineProperty(Sample, categoryMark, { value: 1 });

    Assert.throws(() => {
      Category("invalid")(Sample);
    }, TestingException);
  }
}
