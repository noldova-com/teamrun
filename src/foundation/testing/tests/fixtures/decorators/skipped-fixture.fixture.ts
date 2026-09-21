/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Skip, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
@Skip("the whole fixture is pending")
export class SkippedFixtureTests {
  @TestMethod
  public pending(): void { }
}
