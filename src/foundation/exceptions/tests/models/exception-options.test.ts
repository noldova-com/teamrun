/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class ExceptionOptionsTests {
  @TestMethod
  public hasNoCauseWhenNoneIsGiven(): void {
    Assert.isUndefined(new ExceptionOptions().cause);
  }

  @TestMethod
  public preservesTheCause(): void {
    const cause = new Error("cause");

    Assert.areEqual<unknown>(cause, new ExceptionOptions(cause).cause);
  }
}
