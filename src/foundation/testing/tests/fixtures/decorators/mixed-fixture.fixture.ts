/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class MixedFixtureTests {
  @TestMethod
  public second(): void { }

  @TestMethod
  public first(): void { }

  public unmarkedSupport(): void { }
}
