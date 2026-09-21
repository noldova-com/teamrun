/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Category, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@Category("class-first")
@Category("class-second")
@TestClass
export class CategorizedFixtureTests {
  @Category("method")
  @TestMethod
  public categorized(): void { }

  @TestMethod
  public inherited(): void { }
}
