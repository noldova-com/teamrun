/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class DataFixtureTests {
  @TestMethod
  @TestData("first", 1)
  @TestData("second", 2)
  public acceptsData(_name: string, _value: number): void { }

  @TestMethod
  public ordinary(): void { }
}
