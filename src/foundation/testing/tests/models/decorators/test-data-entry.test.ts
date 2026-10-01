/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestDiscovery, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class TestDataEntryTests {
  @TestMethod
  public copiesTheSuppliedValues(): void {
    const values: [string] = ["original"];
    @TestClass
    class SampleTests {
      @TestData(...values)
      @TestMethod
      public sample(value: string): void {
        void value;
      }
    }

    values[0] = "changed";

    const testClass = new TestDiscovery().discoverModuleExports({ SampleTests }, "sample.test.js", "Sample")[0];
    const method = testClass?.methods[0];
    Assert.isDefined(method);
    Assert.areEqual<unknown>("original", method.testData[0]);
  }
}
