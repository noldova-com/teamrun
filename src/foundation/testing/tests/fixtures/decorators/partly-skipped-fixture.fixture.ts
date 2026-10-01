/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Skip, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class PartlySkippedFixtureTests {
  @TestMethod
  @Skip("this method is pending")
  public pending(): void { }

  @TestMethod
  public active(): void { }
}
