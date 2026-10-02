/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class OrderedFixtureTests {
  public static support(): void { }

  @TestMethod
  public zulu(): void { }

  @TestMethod
  public alpha(): void { }
}
